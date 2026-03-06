from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import json

from app.db.session import get_db
from app.models.course import CourseModule, Course
from app import schemas
from app.api import deps
from app.models.user import User
from pydantic import BaseModel

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}

router = APIRouter()


class VerifyRecallRequest(BaseModel):
    question: str
    answer: str


class SubmitQuizRequest(BaseModel):
    answers: Dict[str, list]


class NotesRequest(BaseModel):
    notes: str


class RegenerateRequest(BaseModel):
    difficulty: str = "intermediate"


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------

@router.patch("/{module_id}/toggle-complete", response_model=schemas.Module)
async def toggle_complete(
    course_id: int,
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Toggle the completion status of a module."""
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id))
    if not course_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    module.is_completed_by_user = not module.is_completed_by_user
    await db.commit()
    await db.refresh(module)
    return module


@router.get("/{module_id}/recall-question")
async def get_recall_question(
    course_id: int,
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    from app.agents.professor import ProfessorAgent
    from app.core.security import decrypt_key

    api_key = course.api_key
    if api_key:
        try:
            api_key = decrypt_key(api_key)
        except Exception:
            pass

    agent = ProfessorAgent(provider=course.provider, model=course.model, api_key=api_key)
    question = await agent.generate_recall_question(module.title, module.content)
    return {"question": question}


@router.post("/{module_id}/verify-recall")
async def verify_recall(
    course_id: int,
    module_id: int,
    payload: VerifyRecallRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    from app.agents.professor import ProfessorAgent
    from app.core.security import decrypt_key

    api_key = course.api_key
    if api_key:
        try:
            api_key = decrypt_key(api_key)
        except Exception:
            pass

    agent = ProfessorAgent(provider=course.provider, model=course.model, api_key=api_key)
    evaluation = await agent.verify_recall_answer(payload.question, payload.answer, module.content)
    return evaluation


@router.post("/{module_id}/submit-quiz")
async def submit_quiz(
    course_id: int,
    module_id: int,
    payload: SubmitQuizRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    module.user_data = json.dumps(payload.answers)
    module.is_completed_by_user = True
    await db.commit()
    await db.refresh(module)
    return module


# ---------------------------------------------------------------------------
# New endpoints
# ---------------------------------------------------------------------------

@router.patch("/{module_id}/notes", response_model=schemas.Module)
async def update_module_notes(
    course_id: int,
    module_id: int,
    payload: NotesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Save or update personal notes for a module."""
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id))
    if not course_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    module.notes = payload.notes
    await db.commit()
    await db.refresh(module)
    return module


@router.post("/{module_id}/audio")
async def generate_module_audio(
    course_id: int,
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Trigger TTS audio generation for a single module."""
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id))
    if not course_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if not module.content:
        raise HTTPException(status_code=400, detail="Module has no content to synthesize")

    if module.audio_status == "generating":
        return {"status": "generating", "message": "Audio is already being generated"}

    module.audio_status = "generating"
    await db.commit()

    from app.tasks.course_tasks import generate_module_audio_task
    generate_module_audio_task.delay(module_id)

    return {"status": "generating", "message": "Module audio generation started"}


@router.get("/{module_id}/audio")
async def get_module_audio(
    course_id: int,
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Stream the TTS audio file for a single module."""
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id))
    if not course_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    from app.services.tts_service import get_module_audio_path
    import os

    audio_path = get_module_audio_path(module_id)
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Module audio not found. Trigger generation first.")

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()
    return Response(content=audio_bytes, media_type="audio/mpeg")


@router.post("/{module_id}/regenerate")
async def regenerate_module(
    course_id: int,
    module_id: int,
    payload: RegenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Regenerate a module's content at a different difficulty level, streamed as SSE.
    """
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if payload.difficulty not in ("beginner", "intermediate", "advanced"):
        raise HTTPException(status_code=400, detail="difficulty must be beginner, intermediate, or advanced")

    module.status = "GENERATING"
    module.flashcards = None
    module.audio_status = None
    await db.commit()

    from app.agents.professor import ProfessorAgent
    from app.core.security import decrypt_key

    api_key = course.api_key
    if api_key:
        try:
            api_key = decrypt_key(api_key)
        except Exception:
            pass

    agent = ProfessorAgent(provider=course.provider or "groq", model=course.model, api_key=api_key)
    content_parts: list[str] = []

    async def stream():
        try:
            async for chunk in agent.generate_module_content_stream(
                topic=course.topic,
                module_title=module.title,
                module_description=module.title,
                difficulty=payload.difficulty,
            ):
                content_parts.append(chunk)
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"

            full_content = "".join(content_parts)
            module.content = full_content
            module.status = "COMPLETED"
            course.mindmap = None
            await db.commit()
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            module.status = "FAILED"
            await db.commit()
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)
