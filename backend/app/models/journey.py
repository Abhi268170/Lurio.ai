from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class Journey(Base):
    __tablename__ = "journeys"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    topic = Column(String, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    owner = relationship("User", back_populates="journeys")
    nodes = relationship("JourneyNode", back_populates="journey", cascade="all, delete-orphan")


class JourneyNode(Base):
    __tablename__ = "journey_nodes"

    id = Column(Integer, primary_key=True, index=True)
    journey_id = Column(Integer, ForeignKey("journeys.id"), nullable=False, index=True)
    topic = Column(String, nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    status = Column(String, default="pending") # undiscovered, pending, generating, completed
    parent_id = Column(Integer, ForeignKey("journey_nodes.id"), nullable=True, index=True)
    
    # Layout hints
    x_position = Column(Float, nullable=True)
    y_position = Column(Float, nullable=True)
    
    is_discovered = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    journey = relationship("Journey", back_populates="nodes")
    parent = relationship("JourneyNode", back_populates="children", remote_side=[id])
    children = relationship("JourneyNode", back_populates="parent")
