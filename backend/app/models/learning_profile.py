from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class UserLearningProfile(Base):
    __tablename__ = "user_learning_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)

    # Active signals (set by feedback form or user preferences)
    preferred_style = Column(String, nullable=True)         # visual | narrative | technical | example_first
    background_level = Column(String, nullable=True)        # none | some | working
    primary_goal = Column(String, nullable=True)            # curiosity | career | academic | interview
    content_pace_preference = Column(String, nullable=True) # simple | balanced | dense

    # Passive signals (computed from behavior)
    avg_comprehension_score = Column(Float, nullable=True)       # 0.0–1.0 rolling average
    avg_time_per_module_seconds = Column(Integer, nullable=True) # rolling average
    total_modules_completed = Column(Integer, default=0)
    total_regenerations = Column(Integer, default=0)
    total_popo_messages = Column(Integer, default=0)

    # Feature usage counters (JSON-like stored as individual columns for simplicity)
    usage_mindmap = Column(Integer, default=0)
    usage_podcast = Column(Integer, default=0)
    usage_flashcards = Column(Integer, default=0)
    usage_pappy = Column(Integer, default=0)
    usage_notebook = Column(Integer, default=0)

    # Feedback form
    feedback_form_shown = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    user = relationship("User", back_populates="learning_profile")


class ModuleAnalytics(Base):
    __tablename__ = "module_analytics"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("course_modules.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    opened_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    time_spent_seconds = Column(Integer, nullable=True)

    checkpoint_score = Column(Float, nullable=True)   # 0.0–1.0, null if not attempted
    checkpoint_attempts = Column(Integer, default=0)
    popo_messages_count = Column(Integer, default=0)
    was_regenerated = Column(Boolean, default=False)
    revisit_count = Column(Integer, default=0)
