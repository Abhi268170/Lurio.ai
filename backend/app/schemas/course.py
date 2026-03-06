from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ModuleBase(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    order: Optional[int] = None
    module_type: Optional[str] = "lesson"


class Module(ModuleBase):
    id: int
    course_id: int
    status: str
    is_completed_by_user: bool = False
    flashcards: Optional[str] = None
    user_data: Optional[str] = None
    notes: Optional[str] = None
    audio_status: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CourseBase(BaseModel):
    topic: str
    title: Optional[str] = None
    provider: Optional[str] = "ollama"
    model: Optional[str] = None
    api_key: Optional[str] = None


class CourseCreate(CourseBase):
    difficulty: Optional[str] = "beginner"
    module_titles: Optional[List[str]] = None  # Pre-selected syllabus from preview


class CourseUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None


class Course(CourseBase):
    id: int
    owner_id: Optional[int] = None
    status: str
    difficulty: Optional[str] = None
    podcast_status: Optional[str] = None
    mindmap: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CourseWithModules(Course):
    modules: List[Module] = []

    class Config:
        from_attributes = True
