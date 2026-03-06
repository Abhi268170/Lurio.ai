from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api import deps
from app.models.user import User
from app.models.learning_profile import UserLearningProfile
from app.services import profile_service

router = APIRouter()


class FeedbackFormPayload(BaseModel):
    content_pace_preference: str   # simple | balanced | dense
    background_level: str          # none | some | working
    primary_goal: str              # curiosity | career | academic | interview


class ProfileUpdatePayload(BaseModel):
    preferred_style: Optional[str] = None
    background_level: Optional[str] = None
    primary_goal: Optional[str] = None
    content_pace_preference: Optional[str] = None


class FeatureUsagePayload(BaseModel):
    feature: str  # mindmap | podcast | flashcards | pappy | notebook


@router.get("/learning")
async def get_learning_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Return the current user's learning profile."""
    profile = await profile_service.get_or_create_profile(current_user.id, db)
    return {
        "preferred_style": profile.preferred_style,
        "background_level": profile.background_level,
        "primary_goal": profile.primary_goal,
        "content_pace_preference": profile.content_pace_preference,
        "avg_comprehension_score": profile.avg_comprehension_score,
        "avg_time_per_module_seconds": profile.avg_time_per_module_seconds,
        "total_modules_completed": profile.total_modules_completed,
        "total_regenerations": profile.total_regenerations,
        "total_popo_messages": profile.total_popo_messages,
        "feature_usage": {
            "mindmap": profile.usage_mindmap or 0,
            "podcast": profile.usage_podcast or 0,
            "flashcards": profile.usage_flashcards or 0,
            "pappy": profile.usage_pappy or 0,
            "notebook": profile.usage_notebook or 0,
        },
        "feedback_form_shown": profile.feedback_form_shown,
    }


@router.patch("/learning")
async def update_learning_profile(
    payload: ProfileUpdatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Manually update style/goal/background preferences."""
    profile = await profile_service.get_or_create_profile(current_user.id, db)
    if payload.preferred_style is not None:
        profile.preferred_style = payload.preferred_style
    if payload.background_level is not None:
        profile.background_level = payload.background_level
    if payload.primary_goal is not None:
        profile.primary_goal = payload.primary_goal
    if payload.content_pace_preference is not None:
        profile.content_pace_preference = payload.content_pace_preference
    await db.commit()
    return {"status": "updated"}


@router.post("/feedback")
async def submit_feedback_form(
    payload: FeedbackFormPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    One-time first-completion feedback form.
    Stores the user's self-reported preferences and marks form as shown.
    """
    valid_pace = {"simple", "balanced", "dense"}
    valid_bg = {"none", "some", "working"}
    valid_goal = {"curiosity", "career", "academic", "interview"}

    if payload.content_pace_preference not in valid_pace:
        raise HTTPException(status_code=400, detail="Invalid content_pace_preference")
    if payload.background_level not in valid_bg:
        raise HTTPException(status_code=400, detail="Invalid background_level")
    if payload.primary_goal not in valid_goal:
        raise HTTPException(status_code=400, detail="Invalid primary_goal")

    profile = await profile_service.get_or_create_profile(current_user.id, db)
    profile.content_pace_preference = payload.content_pace_preference
    profile.background_level = payload.background_level
    profile.primary_goal = payload.primary_goal
    profile.feedback_form_shown = True
    await db.commit()
    return {"status": "saved"}


@router.post("/feature-usage")
async def track_feature_usage(
    payload: FeatureUsagePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Fire-and-forget feature usage tracking."""
    valid = {"mindmap", "podcast", "flashcards", "pappy", "notebook"}
    if payload.feature not in valid:
        raise HTTPException(status_code=400, detail=f"feature must be one of {valid}")
    await profile_service.increment_feature_usage(current_user.id, payload.feature, db)
    return {"status": "ok"}
