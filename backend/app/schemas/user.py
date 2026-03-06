from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class UserBase(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True


class UserCreate(UserBase):
    email: str
    password: Optional[str] = None
    google_id: Optional[str] = None
    full_name: Optional[str] = None


class UserUpdate(UserBase):
    password: Optional[str] = None


class User(UserBase):
    id: Optional[int] = None
    auth_provider: Optional[str] = "local"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
