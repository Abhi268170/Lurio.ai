from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

# Two separate PostgreSQL enum types — must match the DB exactly
_course_status = SAEnum('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', name='coursestatus', create_type=False)
_module_status = SAEnum('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', name='modulestatus', create_type=False)

_module_type = SAEnum('lesson', 'quiz', name='moduletype', create_type=False)

from app.db.base_class import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    topic = Column(String, index=True)
    title = Column(String, nullable=True)
    difficulty = Column(String, nullable=True)
    provider = Column(String, nullable=True)
    model = Column(String, nullable=True)
    api_key = Column(String, nullable=True)
    status = Column(_course_status, default='PENDING')
    podcast_status = Column(String, nullable=True)   # null, generating, completed, failed
    mindmap = Column(Text, nullable=True)             # JSON cached mind map tree
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    owner = relationship("User", back_populates="courses")
    modules = relationship("CourseModule", back_populates="course", cascade="all, delete-orphan")


class CourseModule(Base):
    __tablename__ = "course_modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=True)
    order = Column(Integer, nullable=True)
    status = Column(_module_status, default='PENDING')
    module_type = Column(_module_type, default='lesson')
    flashcards = Column(Text, nullable=True)         # JSON stored as text
    is_completed_by_user = Column(Boolean, default=False)
    user_data = Column(Text, nullable=True)          # JSON stored as text (quiz answers)
    notes = Column(Text, nullable=True)              # User personal notes (plain text/markdown)
    audio_status = Column(String, nullable=True)     # null, generating, completed, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course", back_populates="modules")
