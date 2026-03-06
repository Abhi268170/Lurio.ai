from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    google_id = Column(String, unique=True, nullable=True)
    auth_provider = Column(String, default="local")   # local, google
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    courses = relationship("Course", back_populates="owner", cascade="all, delete-orphan")
    journeys = relationship("Journey", back_populates="owner", cascade="all, delete-orphan")
    learning_profile = relationship("UserLearningProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
