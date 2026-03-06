from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import json

from app.db.session import get_db
from app.models.course import CourseModule, Course
from app.api import deps
from app.models.user import User

router = APIRouter()

@router.post("")
async def generate_flashcards(
    course_id: int,
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Generate or retrieve flashcards for a module."""
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if module.flashcards:
        try:
            return json.loads(module.flashcards)
        except:
            pass
            
    # Need to generate them
    from app.agents.professor import ProfessorAgent
    from app.core.security import decrypt_key
    
    api_key = course.api_key
    if api_key:
        try: api_key = decrypt_key(api_key)
        except: pass
        
    agent = ProfessorAgent(provider=course.provider, model=course.model, api_key=api_key)
    cards = await agent.generate_flashcards(module.title, module.content)
    
    # Save cache to db
    module.flashcards = json.dumps(cards)
    await db.commit()
    return cards
