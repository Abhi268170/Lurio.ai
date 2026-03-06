from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class JourneyNodeBase(BaseModel):
    topic: str
    status: Optional[str] = "pending"
    parent_id: Optional[int] = None
    x_position: Optional[float] = 0.0
    y_position: Optional[float] = 0.0
    is_discovered: Optional[bool] = False

class JourneyNodeCreate(JourneyNodeBase):
    journey_id: int

class JourneyNode(JourneyNodeBase):
    id: int
    course_id: Optional[int] = None
    journey_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class JourneyBase(BaseModel):
    topic: str

class JourneyCreate(JourneyBase):
    difficulty: Optional[str] = "beginner"
    provider: Optional[str] = "ollama"
    model: Optional[str] = None
    api_key: Optional[str] = None

class Journey(JourneyBase):
    id: int
    owner_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class JourneyWithNodes(Journey):
    nodes: List[JourneyNode] = []

    class Config:
        from_attributes = True
