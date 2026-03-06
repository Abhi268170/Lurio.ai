from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import json

from app.db.session import get_db
from app.models.course import CourseModule, Course
from app import schemas
from app.api import deps
from app.models.user import User

router = APIRouter()

@router.post("", response_model=schemas.Module)
async def generate_final_revision(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Generate a final 10-question multiple-choice quiz covering all modules."""
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Fetch all modules to summarize for quiz generation
    mod_res = await db.execute(select(CourseModule).where(CourseModule.course_id == course_id).order_by(CourseModule.order))
    modules = mod_res.scalars().all()
    
    # Check if a quiz module already exists
    existing_quiz = next((m for m in modules if m.module_type == 'quiz'), None)
    if existing_quiz:
        return existing_quiz

    modules_data = [{"title": m.title, "content": m.content or ""} for m in modules if m.module_type != 'quiz']

    from app.agents.professor import ProfessorAgent
    from app.core.security import decrypt_key
    
    api_key = course.api_key
    if api_key:
        try: api_key = decrypt_key(api_key)
        except: pass
        
    agent = ProfessorAgent(provider=course.provider, model=course.model, api_key=api_key)
    quiz_questions = await agent.generate_final_quiz(course.topic, modules_data)
    
    # Re-structure quiz correctly for frontend
    # Frontend expects: [{ "id": 1, "type": "single", "question": "...", "options": [...], "explanation": "..." }]
    formatted_questions = []
    for i, q in enumerate(quiz_questions):
        options = []
        for opt in q.get("options", []):
            options.append({
                "text": opt,
                "isCorrect": opt == q.get("correct_answer")
            })
        formatted_questions.append({
            "id": i + 1,
            "type": "single",
            "question": q.get("question", ""),
            "options": options,
            "explanation": q.get("explanation", "The correct answer is " + str(q.get("correct_answer", "")))
        })

    # Create a new module of type 'quiz'
    quiz_module = CourseModule(
        course_id=course_id,
        title="Final Revision",
        content=json.dumps(formatted_questions),
        order=len(modules),
        status="COMPLETED",
        module_type="quiz",
        is_completed_by_user=False
    )
    db.add(quiz_module)
    await db.commit()
    await db.refresh(quiz_module)
    
    return quiz_module
