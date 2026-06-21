"""
Interview history routes: save, list, and delete past interview reports.
Includes proctor flag storage and retrieval.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List

from database import get_db
from models.db_models import InterviewRecord, ProctorFlag
from models.schemas import ProctorFlagItem
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
    proctor_flags: Optional[List[ProctorFlagItem]] = None


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
    await db.flush()  # Get the record.id before inserting flags

    # Save proctor flags if provided
    if req.proctor_flags:
        for flag in req.proctor_flags:
            proctor_flag = ProctorFlag(
                record_id=record.id,
                timestamp=flag.timestamp,
                object_label=flag.object_label,
                confidence=flag.confidence,
                screenshot=flag.screenshot,
            )
            db.add(proctor_flag)

    await db.commit()
    await db.refresh(record)

    flag_count = len(req.proctor_flags) if req.proctor_flags else 0
    logger.info(f"Report saved for user {current_user['email']}, record {record.id}, {flag_count} proctor flags")
    return {"message": "Report saved successfully.", "record": record.to_dict()}


@router.get("/")
async def get_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all past interview records for the authenticated user (newest first)."""
    result = await db.execute(
        select(InterviewRecord)
        .options(selectinload(InterviewRecord.proctor_flags))
        .where(InterviewRecord.user_id == current_user["sub"])
        .order_by(InterviewRecord.created_at.desc())
    )
    records = result.scalars().all()
    return {"records": [r.to_dict() for r in records]}


@router.get("/{record_id}/proctor-flags")
async def get_proctor_flags(
    record_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all proctor flags (with screenshots) for a specific interview record."""
    result = await db.execute(
        select(InterviewRecord)
        .options(selectinload(InterviewRecord.proctor_flags))
        .where(
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

    return {
        "flags": [f.to_dict() for f in record.proctor_flags],
    }


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
