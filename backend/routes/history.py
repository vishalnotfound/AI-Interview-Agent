"""
Interview history routes: save, list, and delete past interview reports.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models.db_models import InterviewRecord
from services.auth_service import get_current_user

logger = logging.getLogger("history")

router = APIRouter(prefix="/history", tags=["history"])


# ─── Request schemas ───

class SaveReportRequest(BaseModel):
    overall_score: float
    summary: str
    strong_areas: str
    weak_areas: str
    hire_recommendation: str
    improvement_roadmap: str


# ─── Routes ───

@router.post("/save")
async def save_report(
    req: SaveReportRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a completed interview report for the authenticated user."""
    record = InterviewRecord(
        user_id=current_user["sub"],
        overall_score=req.overall_score,
        summary=req.summary,
        strong_areas=req.strong_areas,
        weak_areas=req.weak_areas,
        hire_recommendation=req.hire_recommendation,
        improvement_roadmap=req.improvement_roadmap,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    logger.info(f"Report saved for user {current_user['email']}, record {record.id}")
    return {"message": "Report saved successfully.", "record": record.to_dict()}


@router.get("/")
async def get_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all past interview records for the authenticated user (newest first)."""
    result = await db.execute(
        select(InterviewRecord)
        .where(InterviewRecord.user_id == current_user["sub"])
        .order_by(InterviewRecord.created_at.desc())
    )
    records = result.scalars().all()
    return {"records": [r.to_dict() for r in records]}


@router.delete("/{record_id}")
async def delete_record(
    record_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific interview record (only if owned by the authenticated user)."""
    result = await db.execute(
        select(InterviewRecord).where(
            InterviewRecord.id == record_id,
            InterviewRecord.user_id == current_user["sub"],
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found.",
        )

    await db.delete(record)
    await db.commit()

    logger.info(f"Record {record_id} deleted by user {current_user['email']}")
    return {"message": "Record deleted successfully."}
