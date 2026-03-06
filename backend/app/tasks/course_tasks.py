import asyncio
import json
from celery.utils.log import get_task_logger
from sqlalchemy.future import select

from app.db.session import SessionLocal
from app.models.course import Course, CourseModule
from app.models.user import User  # Required: Course.owner = relationship("User") needs User loaded
from app.core.security import decrypt_key
from app.core.celery_app import celery_app

logger = get_task_logger(__name__)

STREAM_CHANNEL = "course:{course_id}:stream"


@celery_app.task(name="app.tasks.course_tasks.generate_course_content")
def generate_course_content(course_id: int, preset_titles: list = None):
    """
    Task to generate the course syllabus and all module content using AI.
    If preset_titles is provided (from syllabus-preview selection), skip syllabus generation.
    Streams content chunks to Redis so the WebSocket can relay them in real-time.
    """
    async def run():
        import redis.asyncio as aioredis
        from app.agents.architect import ArchitectAgent
        from app.core.config import settings

        channel = STREAM_CHANNEL.format(course_id=course_id)
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

        async with SessionLocal() as db:
            result = await db.execute(select(Course).where(Course.id == course_id))
            course = result.scalar_one_or_none()
            if not course:
                logger.error(f"Course {course_id} not found")
                await redis_client.aclose()
                return

            try:
                course.status = "GENERATING"
                await db.commit()

                api_key = None
                if course.api_key:
                    try:
                        api_key = decrypt_key(course.api_key)
                    except Exception:
                        api_key = course.api_key

                agent = ArchitectAgent(
                    provider=course.provider or "ollama",
                    model=course.model,
                    api_key=api_key,
                )

                # Step 1: Use preset titles or generate syllabus
                import re
                if preset_titles and len(preset_titles) >= 1:
                    module_titles = preset_titles[:5]
                    logger.info(f"Using preset syllabus for course {course_id}: {module_titles}")
                else:
                    syllabus_prompt = f"""
                    Create a course syllabus for the topic: "{course.topic}".
                    The course should have exactly 5 modules.
                    Return ONLY a JSON array of module titles (no other text), like:
                    ["Module 1: Introduction", "Module 2: Core Concepts", ...]
                    """
                    syllabus_raw = await agent.generate_content(syllabus_prompt)

                    try:
                        match = re.search(r'\[.*?\]', syllabus_raw, re.DOTALL)
                        if match:
                            module_titles = json.loads(match.group())
                        else:
                            module_titles = json.loads(syllabus_raw.strip())
                    except Exception:
                        module_titles = [
                            f"Introduction to {course.topic}",
                            f"Core Concepts of {course.topic}",
                            f"Intermediate {course.topic}",
                            f"Advanced {course.topic}",
                            f"Practical Applications of {course.topic}",
                        ]

                course.title = f"{course.topic}"
                await db.commit()

                # Step 2: Stream each module's content, publishing chunks to Redis
                for i, title in enumerate(module_titles[:5]):
                    module = CourseModule(
                        course_id=course.id,
                        title=title,
                        order=i,
                        status="GENERATING",
                        module_type="lesson",
                    )
                    db.add(module)
                    await db.commit()
                    await db.refresh(module)

                    # Announce the new module to the WebSocket
                    await redis_client.publish(channel, json.dumps({
                        "type": "module_start",
                        "module_id": module.id,
                        "module_title": title,
                        "order": i,
                    }))

                    content_prompt = f"""
                    Write a detailed educational lesson for the module titled: "{title}"

                    This is part of a course on: {course.topic}

                    Format in clear Markdown with:
                    - An introduction
                    - 2-3 main sections with explanations
                    - Key takeaways or summary

                    Be thorough, engaging, and educational. Aim for ~500-800 words.
                    """

                    # Stream content chunks and publish each to Redis
                    content_parts = []
                    async for chunk in agent.generate_content_stream(content_prompt):
                        content_parts.append(chunk)
                        await redis_client.publish(channel, json.dumps({
                            "type": "content_chunk",
                            "module_id": module.id,
                            "chunk": chunk,
                        }))

                    module.content = "".join(content_parts)
                    module.status = "COMPLETED"
                    await db.commit()

                    # Announce module completion
                    await redis_client.publish(channel, json.dumps({
                        "type": "module_complete",
                        "module_id": module.id,
                    }))

                    logger.info(f"Module {i+1}/{len(module_titles)} complete: {title}")

                # Step 3: Mark course as completed
                course.status = "COMPLETED"

                # Update Journey node if this course belongs to one
                from app.models.journey import JourneyNode
                node_res = await db.execute(select(JourneyNode).where(JourneyNode.course_id == course.id))
                node = node_res.scalar_one_or_none()
                if node:
                    node.status = "completed"

                await db.commit()

                await redis_client.publish(channel, json.dumps({
                    "type": "course_complete",
                    "status": "COMPLETED",
                }))

                logger.info(f"Course {course_id} generation complete.")

            except Exception as e:
                logger.error(f"Course {course_id} generation failed: {e}", exc_info=True)
                course.status = "FAILED"
                await db.commit()
                try:
                    await redis_client.publish(channel, json.dumps({
                        "type": "course_complete",
                        "status": "FAILED",
                    }))
                except Exception:
                    pass
                raise
            finally:
                await redis_client.aclose()

    asyncio.run(run())


@celery_app.task(name="app.tasks.course_tasks.regenerate_module_task")
def regenerate_module_task(module_id: int, difficulty: str):
    """
    Regenerate a single module's content at a specified difficulty level.
    Uses ProfessorAgent which tailors language complexity to the difficulty.
    """
    async def run():
        from app.agents.professor import ProfessorAgent

        async with SessionLocal() as db:
            result = await db.execute(select(CourseModule).where(CourseModule.id == module_id))
            module = result.scalar_one_or_none()
            if not module:
                logger.error(f"Module {module_id} not found for regeneration")
                return

            course_res = await db.execute(select(Course).where(Course.id == module.course_id))
            course = course_res.scalar_one_or_none()
            if not course:
                logger.error(f"Course not found for module {module_id}")
                return

            try:
                api_key = None
                if course.api_key:
                    try:
                        api_key = decrypt_key(course.api_key)
                    except Exception:
                        api_key = course.api_key

                agent = ProfessorAgent(
                    provider=course.provider or "groq",
                    model=course.model,
                    api_key=api_key,
                )
                content = await agent.generate_module_content(
                    topic=course.topic,
                    module_title=module.title,
                    module_description=module.title,
                    difficulty=difficulty,
                )

                module.content = content
                module.status = "COMPLETED"
                # Invalidate the course-level mindmap since content changed
                course.mindmap = None
                await db.commit()
                logger.info(f"Module {module_id} regenerated at '{difficulty}' difficulty.")

            except Exception as e:
                module.status = "FAILED"
                await db.commit()
                logger.error(f"Module {module_id} regeneration failed: {e}", exc_info=True)
                raise

    asyncio.run(run())


@celery_app.task(name="app.tasks.course_tasks.generate_module_audio_task")
def generate_module_audio_task(module_id: int):
    """
    Generate TTS audio for a single module.
    First rewrites the content as a friendly teacher narration via LLM,
    then synthesises speech (ElevenLabs → Edge TTS fallback).
    """
    async def run():
        from app.services.tts_service import get_module_audio_path, synthesize_module_audio
        from app.agents.architect import ArchitectAgent
        from app.core.config import settings

        async with SessionLocal() as db:
            result = await db.execute(select(CourseModule).where(CourseModule.id == module_id))
            module = result.scalar_one_or_none()
            if not module or not module.content:
                logger.error(f"Module {module_id} not found or has no content")
                return

            course_res = await db.execute(select(Course).where(Course.id == module.course_id))
            course = course_res.scalar_one_or_none()

            try:
                # Step 1: Rewrite as natural teacher narration
                api_key = None
                if course and course.api_key:
                    try:
                        api_key = decrypt_key(course.api_key)
                    except Exception:
                        api_key = course.api_key

                agent = ArchitectAgent(
                    provider=(course.provider if course else None) or "groq",
                    model=(course.model if course else None),
                    api_key=api_key,
                )

                narration_prompt = f"""You are a warm, enthusiastic teacher recording an audio lesson.
Rewrite the following lesson content as a natural spoken narration script.

Rules:
- Write EXACTLY as you would speak it aloud — casual, friendly, encouraging
- Use simple everyday language; avoid jargon unless you explain it
- Keep it concise: aim for roughly 300–450 words (about 2–3 minutes of audio)
- NO markdown, NO bullet points, NO headers — only flowing, conversational prose
- Begin with a short friendly hook like "Hey! Today we're diving into..."
- End with one clear key takeaway sentence
- Do NOT include stage directions or labels like "[pause]"

Lesson title: {module.title}

Lesson content:
{module.content}

Return ONLY the narration script, nothing else."""

                logger.info(f"Rewriting module {module_id} content as teacher narration...")
                narration_script = await agent.generate_content(narration_prompt)

                # Fallback: if LLM returned nothing useful, use stripped original
                if not narration_script or len(narration_script.strip()) < 100:
                    logger.warning(f"Narration rewrite too short for module {module_id}, using original content")
                    narration_script = module.content

                # Step 2: TTS the narration
                output_path = get_module_audio_path(module_id)
                await synthesize_module_audio(narration_script, output_path)

                module.audio_status = "completed"
                await db.commit()
                logger.info(f"Module {module_id} audio generated at {output_path}")

            except Exception as e:
                module.audio_status = "failed"
                await db.commit()
                logger.error(f"Module {module_id} audio generation failed: {e}", exc_info=True)
                raise

    asyncio.run(run())


@celery_app.task(name="app.tasks.course_tasks.generate_podcast_task")
def generate_podcast_task(course_id: int):
    """
    Celery task to generate a podcast for a course.
    """
    async def run():
        from app.agents.podcast_agent import PodcastAgent
        from app.services.tts_service import assemble_podcast, get_podcast_path

        async with SessionLocal() as db:
            result = await db.execute(select(Course).where(Course.id == course_id))
            course = result.scalar_one_or_none()
            if not course:
                return

            try:
                mod_result = await db.execute(
                    select(CourseModule)
                    .where(CourseModule.course_id == course_id)
                    .order_by(CourseModule.order)
                )
                modules = mod_result.scalars().all()
                modules_data = [{"title": m.title, "content": m.content or ""} for m in modules]

                api_key = None
                if course.api_key:
                    try:
                        api_key = decrypt_key(course.api_key)
                    except Exception:
                        api_key = course.api_key

                agent = PodcastAgent(
                    provider=course.provider or "groq",
                    model=course.model,
                    api_key=api_key,
                )
                script = await agent.generate_script(course.topic, modules_data)

                output_path = get_podcast_path(course_id)
                await assemble_podcast(script, output_path)

                course.podcast_status = "completed"
                await db.commit()
                logger.info(f"Podcast for course {course_id} completed.")

            except Exception as e:
                course.podcast_status = "failed"
                await db.commit()
                logger.error(f"Podcast generation failed for course {course_id}: {e}", exc_info=True)
                raise

    asyncio.run(run())
