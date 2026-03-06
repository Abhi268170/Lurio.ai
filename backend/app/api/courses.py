from typing import Any, List, Optional
import json
import re

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.course import Course, CourseModule
from app.core.security import encrypt_key, decrypt_key
from app import schemas
from app.api import deps
from app.models.user import User

router = APIRouter()


class SyllabusPreviewRequest(BaseModel):
    topic: str
    difficulty: Optional[str] = "beginner"


@router.post("/syllabus-preview")
async def preview_syllabus(
    body: SyllabusPreviewRequest,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Generate 3 distinct syllabus options for a topic without creating a course.
    The frontend shows these as cards; the user picks one, then calls POST /courses
    with the selected module_titles list.
    """
    from app.agents.architect import ArchitectAgent

    agent = ArchitectAgent(
        provider="groq",
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY,
    )

    prompt = f"""
    Generate 3 DISTINCT course syllabuses for the topic: "{body.topic}" at {body.difficulty} level.
    Each syllabus must have exactly 5 module titles.
    Each option should approach the topic from a meaningfully different angle or structure.

    Return ONLY valid JSON in this exact format, no other text:
    {{
      "options": [
        ["Option 1 Module 1", "Option 1 Module 2", "Option 1 Module 3", "Option 1 Module 4", "Option 1 Module 5"],
        ["Option 2 Module 1", "Option 2 Module 2", "Option 2 Module 3", "Option 2 Module 4", "Option 2 Module 5"],
        ["Option 3 Module 1", "Option 3 Module 2", "Option 3 Module 3", "Option 3 Module 4", "Option 3 Module 5"]
      ]
    }}
    """

    response = await agent.generate_content(prompt)

    try:
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            data = json.loads(response.strip())
        options = data.get("options", [])
        # Ensure each option has exactly 5 titles
        options = [opt[:5] for opt in options if isinstance(opt, list)]
    except Exception:
        options = [
            [f"Introduction to {body.topic}", f"Core Concepts", f"Intermediate Topics", f"Advanced Topics", f"Practical Applications"],
            [f"Why {body.topic} Matters", f"Foundations", f"Key Techniques", f"Real-World Use", f"Mastery & Next Steps"],
            [f"{body.topic} History", f"Principles", f"Tools & Methods", f"Case Studies", f"Future Directions"],
        ]

    return {"options": options[:3]}


@router.get("/{id}/modules", response_model=List[schemas.Module])
async def read_course_modules(
    *,
    db: AsyncSession = Depends(get_db),
    id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get all modules for a course."""
    result = await db.execute(
        select(CourseModule)
        .where(CourseModule.course_id == id)
        .order_by(CourseModule.order)
    )
    return result.scalars().all()


@router.get("/", response_model=List[schemas.Course])
async def read_courses(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Retrieve all courses for the current user."""
    result = await db.execute(
        select(Course)
        .where(Course.owner_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Course.id.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=schemas.Course)
async def create_course(
    *,
    db: AsyncSession = Depends(get_db),
    course_in: schemas.CourseCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Create a new course and kick off generation."""
    # Always use system defaults for provider and model
    course = Course(
        topic=course_in.topic,
        title=course_in.title or course_in.topic,
        difficulty=course_in.difficulty,
        provider="groq",
        model=settings.GROQ_MODEL,
        api_key=None, # Key is stored in system settings, not encrypted in DB anymore
        owner_id=current_user.id,
        status="PENDING",
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)

    # Lazy import to avoid circular imports at module level
    from app.tasks.course_tasks import generate_course_content
    generate_course_content.delay(course.id, course_in.module_titles)

    return course


@router.get("/{id}", response_model=schemas.CourseWithModules)
async def read_course(
    *,
    db: AsyncSession = Depends(get_db),
    id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get course by ID, including all its modules."""
    result = await db.execute(
        select(Course)
        .options(selectinload(Course.modules))
        .where(Course.id == id, Course.owner_id == current_user.id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.delete("/{id}", response_model=schemas.Course)
async def delete_course(
    *,
    db: AsyncSession = Depends(get_db),
    id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Delete a course."""
    result = await db.execute(
        select(Course).where(Course.id == id, Course.owner_id == current_user.id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    await db.delete(course)
    await db.commit()
    return course


@router.post("/{course_id}/podcast")
async def generate_podcast(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Trigger podcast generation for a course."""
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.owner_id == current_user.id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.podcast_status == "generating":
        return {"status": "generating", "message": "Podcast is already being generated"}

    course.podcast_status = "generating"
    await db.commit()

    from app.tasks.course_tasks import generate_podcast_task
    generate_podcast_task.delay(course_id)

    return {"status": "generating", "message": "Podcast generation started"}


@router.get("/{course_id}/podcast/audio")
async def get_podcast_audio(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Stream the podcast audio file."""
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.owner_id == current_user.id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    from app.services.tts_service import get_podcast_path
    import os
    audio_path = get_podcast_path(course_id)
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Podcast audio not found")

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()
    return Response(content=audio_bytes, media_type="audio/mpeg")


@router.get("/{id}/mindmap")
async def get_course_mindmap(
    *,
    db: AsyncSession = Depends(get_db),
    id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Generate (and cache) a hierarchical mind map for a completed course.
    Returns a JSON tree: { "concept": str, "children": [...] }
    """
    result = await db.execute(
        select(Course)
        .options(selectinload(Course.modules))
        .where(Course.id == id, Course.owner_id == current_user.id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Return cached mindmap from DB if available
    if course.mindmap:
        try:
            return json.loads(course.mindmap)
        except Exception:
            pass

    if course.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Course must be completed before generating a mind map")

    from app.agents.architect import ArchitectAgent

    api_key = course.api_key
    if api_key:
        try:
            api_key = decrypt_key(api_key)
        except Exception:
            pass

    full_content = "\n\n".join([
        f"{(m.content or '')[:600]}"
        for m in sorted(course.modules, key=lambda x: x.order or 0)
    ])

    prompt = f"""You are building a concept mind map for a student who just studied a course on "{course.topic}".

Course content:
{full_content}

Your task: Extract the KEY CONCEPTS, IDEAS, and TERMS that a student should understand — NOT the module titles or lesson structure.

Think like a student making a revision mind map: What are the actual ideas? What vocabulary, theories, techniques, or principles were taught?

Rules:
- Root node concept = "{course.topic}"
- Level 1 children (3-5): The major concept areas actually taught (e.g. "Neural Networks", "Gradient Descent", "Overfitting") — never use module/lesson titles
- Level 2 children (2-4 each): Specific sub-concepts within each area (e.g. under "Neural Networks" → "Activation Functions", "Backpropagation", "Layers")
- Level 3 children (optional, 2-3): Granular terms or techniques if relevant
- Every node must be a concept name, not a sentence or module title
- Each node: {{"concept": "string", "children": []}}
- Return ONLY valid JSON, no other text"""

    agent = ArchitectAgent(
        provider=course.provider or "groq",
        model=course.model,
        api_key=api_key,
    )
    response = await agent.generate_content(prompt)

    try:
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            mindmap = json.loads(match.group())
        else:
            mindmap = json.loads(response.strip())
    except Exception:
        # Fallback: flat tree from module titles
        mindmap = {
            "concept": course.topic,
            "children": [
                {"concept": m.title, "children": []}
                for m in sorted(course.modules, key=lambda x: x.order or 0)
            ],
        }

    course.mindmap = json.dumps(mindmap)
    await db.commit()

    return mindmap


class DefineRequest(BaseModel):
    concept: str


@router.post("/{id}/mindmap/define")
async def define_mindmap_concept(
    *,
    db: AsyncSession = Depends(get_db),
    id: int,
    body: DefineRequest,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Return a 2-3 sentence AI-generated definition for a mind map concept."""
    result = await db.execute(
        select(Course).where(Course.id == id, Course.owner_id == current_user.id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    from app.agents.architect import ArchitectAgent

    api_key = course.api_key
    if api_key:
        try:
            api_key = decrypt_key(api_key)
        except Exception:
            pass

    agent = ArchitectAgent(
        provider=course.provider or "groq",
        model=course.model,
        api_key=api_key,
    )

    prompt = f"""Define the concept "{body.concept}" as it relates to the course topic "{course.topic}".
Write 2-3 clear, concise sentences. Return only the definition text, no extra formatting."""

    definition = await agent.generate_content(prompt)
    return {"concept": body.concept, "definition": definition.strip()}


@router.get("/{id}/download")
async def download_course(
    *,
    db: AsyncSession = Depends(get_db),
    id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Download course content as a text file."""
    result = await db.execute(
        select(Course)
        .options(selectinload(Course.modules))
        .where(Course.id == id, Course.owner_id == current_user.id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    content = f"COURSE: {course.title}\nTOPIC: {course.topic}\n\n"
    for module in sorted(course.modules, key=lambda x: x.order):
        content += f"--- {module.title} ---\n\n"
        content += f"{module.content}\n\n"

    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={course.topic.replace(' ', '_')}.txt"}
    )
