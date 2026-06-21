"""
SQLAlchemy ORM models for User accounts and Interview history.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationship to interview records
    interviews = relationship("InterviewRecord", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"


class InterviewRecord(Base):
    __tablename__ = "interview_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    overall_score = Column(Float, nullable=False)
    summary = Column(Text, nullable=False)
    strong_areas = Column(Text, nullable=False)
    weak_areas = Column(Text, nullable=False)
    hire_recommendation = Column(String(50), nullable=False)
    improvement_roadmap = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationship back to user
    user = relationship("User", back_populates="interviews")

    # Relationship to proctor flags
    proctor_flags = relationship("ProctorFlag", back_populates="record", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "overall_score": self.overall_score,
            "summary": self.summary,
            "strong_areas": self.strong_areas,
            "weak_areas": self.weak_areas,
            "hire_recommendation": self.hire_recommendation,
            "improvement_roadmap": self.improvement_roadmap,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "flag_count": len(self.proctor_flags) if self.proctor_flags else 0,
        }


class ProctorFlag(Base):
    """Stores a single proctoring detection event with a screenshot."""
    __tablename__ = "proctor_flags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(
        UUID(as_uuid=True),
        ForeignKey("interview_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp = Column(String(50), nullable=False)
    object_label = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    screenshot = Column(Text, nullable=False)  # base64 JPEG data URL

    # Relationship back to interview record
    record = relationship("InterviewRecord", back_populates="proctor_flags")

    def to_dict(self):
        return {
            "id": str(self.id),
            "timestamp": self.timestamp,
            "object_label": self.object_label,
            "confidence": self.confidence,
            "screenshot": self.screenshot,
        }
