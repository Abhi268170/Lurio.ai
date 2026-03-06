"""
Profile service — manages UserLearningProfile and ModuleAnalytics.
All methods are async-compatible with the FastAPI/SQLAlchemy async stack.
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.sql import func

from app.models.learning_profile import UserLearningProfile, ModuleAnalytics


# ─── Profile helpers ─────────────────────────────────────────────────────────

async def get_or_create_profile(user_id: int, db: AsyncSession) -> UserLearningProfile:
    result = await db.execute(
        select(UserLearningProfile).where(UserLearningProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = UserLearningProfile(user_id=user_id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


async def update_comprehension_score(user_id: int, new_score: float, db: AsyncSession) -> None:
    """Rolling average of checkpoint/recall scores."""
    profile = await get_or_create_profile(user_id, db)
    n = profile.total_modules_completed or 1
    if profile.avg_comprehension_score is None:
        profile.avg_comprehension_score = new_score
    else:
        profile.avg_comprehension_score = (
            (profile.avg_comprehension_score * n + new_score) / (n + 1)
        )
    await db.commit()


async def update_time_on_module(user_id: int, seconds: int, db: AsyncSession) -> None:
    """Rolling average of time spent per module."""
    profile = await get_or_create_profile(user_id, db)
    n = max(profile.total_modules_completed or 1, 1)
    if profile.avg_time_per_module_seconds is None:
        profile.avg_time_per_module_seconds = seconds
    else:
        profile.avg_time_per_module_seconds = int(
            (profile.avg_time_per_module_seconds * n + seconds) / (n + 1)
        )
    await db.commit()


async def increment_module_completed(user_id: int, db: AsyncSession) -> int:
    """Increments total_modules_completed and returns the NEW count."""
    profile = await get_or_create_profile(user_id, db)
    profile.total_modules_completed = (profile.total_modules_completed or 0) + 1
    await db.commit()
    return profile.total_modules_completed


async def increment_feature_usage(user_id: int, feature: str, db: AsyncSession) -> None:
    """feature: mindmap | podcast | flashcards | pappy | notebook"""
    profile = await get_or_create_profile(user_id, db)
    col = f"usage_{feature}"
    if hasattr(profile, col):
        setattr(profile, col, (getattr(profile, col) or 0) + 1)
        await db.commit()


async def increment_regeneration(user_id: int, db: AsyncSession) -> None:
    profile = await get_or_create_profile(user_id, db)
    profile.total_regenerations = (profile.total_regenerations or 0) + 1
    await db.commit()


async def increment_popo_messages(user_id: int, db: AsyncSession) -> None:
    profile = await get_or_create_profile(user_id, db)
    profile.total_popo_messages = (profile.total_popo_messages or 0) + 1
    await db.commit()


# ─── Module analytics ────────────────────────────────────────────────────────

async def get_or_create_module_analytics(
    module_id: int, user_id: int, db: AsyncSession
) -> ModuleAnalytics:
    result = await db.execute(
        select(ModuleAnalytics).where(
            ModuleAnalytics.module_id == module_id,
            ModuleAnalytics.user_id == user_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        record = ModuleAnalytics(module_id=module_id, user_id=user_id)
        db.add(record)
        await db.commit()
        await db.refresh(record)
    return record


async def record_module_open(module_id: int, user_id: int, db: AsyncSession) -> None:
    from datetime import datetime, timezone
    record = await get_or_create_module_analytics(module_id, user_id, db)
    if record.opened_at is not None:
        record.revisit_count = (record.revisit_count or 0) + 1
    record.opened_at = datetime.now(timezone.utc)
    await db.commit()


async def record_module_complete(
    module_id: int, user_id: int, time_spent_seconds: int, db: AsyncSession
) -> None:
    from datetime import datetime, timezone
    record = await get_or_create_module_analytics(module_id, user_id, db)
    record.completed_at = datetime.now(timezone.utc)
    record.time_spent_seconds = time_spent_seconds
    await db.commit()
    # Also update profile rolling average
    await update_time_on_module(user_id, time_spent_seconds, db)


async def record_checkpoint_result(
    module_id: int, user_id: int, score: float, db: AsyncSession
) -> None:
    record = await get_or_create_module_analytics(module_id, user_id, db)
    record.checkpoint_score = score
    record.checkpoint_attempts = (record.checkpoint_attempts or 0) + 1
    await db.commit()
    await update_comprehension_score(user_id, score, db)


async def record_module_regenerated(module_id: int, user_id: int, db: AsyncSession) -> None:
    record = await get_or_create_module_analytics(module_id, user_id, db)
    record.was_regenerated = True
    await db.commit()
    await increment_regeneration(user_id, db)


# ─── Prompt injection builder ────────────────────────────────────────────────

async def get_profile_prompt_injection(user_id: int, db: AsyncSession) -> str:
    """
    Builds a concise student profile string to inject into Professor/Architect prompts.
    Returns empty string if no useful profile data exists yet.
    """
    result = await db.execute(
        select(UserLearningProfile).where(UserLearningProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return ""

    parts = []

    if profile.background_level:
        bg_map = {
            "none": "completely new to this topic with no prior knowledge",
            "some": "has some prior exposure but is not an expert",
            "working": "already works with this topic professionally",
        }
        parts.append(f"Student background: {bg_map.get(profile.background_level, profile.background_level)}")

    if profile.primary_goal:
        goal_map = {
            "curiosity": "learning out of personal curiosity — keep it engaging and interesting",
            "career": "learning for career/work purposes — emphasize practical applications",
            "academic": "studying academically — use formal structure and cite concepts clearly",
            "interview": "preparing for job interviews — highlight key definitions and common questions",
        }
        parts.append(f"Learning goal: {goal_map.get(profile.primary_goal, profile.primary_goal)}")

    if profile.content_pace_preference:
        pace_map = {
            "simple": "prefers simple, concise explanations with minimal jargon",
            "balanced": "comfortable with moderate depth and standard explanations",
            "dense": "wants thorough, detailed explanations with full technical depth",
        }
        parts.append(f"Preferred content depth: {pace_map.get(profile.content_pace_preference, profile.content_pace_preference)}")

    if profile.avg_comprehension_score is not None:
        if profile.avg_comprehension_score < 0.5:
            parts.append(
                "Comprehension note: this student has been struggling (avg score "
                f"{profile.avg_comprehension_score:.0%}) — use more analogies, simpler language, "
                "and break concepts into smaller steps"
            )
        elif profile.avg_comprehension_score > 0.85:
            parts.append(
                "Comprehension note: this student has strong comprehension "
                f"(avg score {profile.avg_comprehension_score:.0%}) — you can be concise and assume "
                "concepts are understood quickly"
            )

    # Infer style from feature usage
    visual_score = (profile.usage_mindmap or 0) + (profile.usage_podcast or 0)
    social_score = (profile.usage_pappy or 0)
    if visual_score > 3:
        parts.append(
            "Style signal: student frequently uses visual/audio tools — use structured layouts, "
            "clear examples, and analogies"
        )
    if social_score > 2:
        parts.append(
            "Style signal: student often uses the 'Teach Pappy' feature — they learn well by "
            "explaining concepts; include prompts that encourage self-explanation"
        )

    if profile.total_regenerations and profile.total_regenerations > 2:
        parts.append(
            f"Note: student has regenerated content {profile.total_regenerations} times in the past — "
            "the previous explanations may not have been clear enough; try a different approach"
        )

    if not parts:
        return ""

    return "\n\nSTUDENT PROFILE (adjust your explanation accordingly):\n" + "\n".join(
        f"- {p}" for p in parts
    )
