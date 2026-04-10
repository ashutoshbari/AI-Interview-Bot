import logging
import os
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models.candidate import Candidate
from app.schemas.candidate import CandidateListResponse
from app.services.email_service import email_manager
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/send-reminders")
async def send_reminders(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Scans for candidates with 'registered' or 'in_progress' status 
    and sends them a reminder email.
    """
    result = await db.execute(
        select(Candidate).where(
            Candidate.status.in_(["registered", "in_progress"]),
            Candidate.email != None
        )
    )
    candidates = result.scalars().all()
    count = 0
    
    for cand in candidates:
        # Generate a resume link (pointing to the frontend start page)
        resume_link = f"http://localhost:3000/interview?candidateId={cand.id}&name={cand.name}"
        
        background_tasks.add_task(
            email_manager.send_incomplete_reminder,
            email=cand.email,
            name=cand.name,
            resume_link=resume_link
        )
        count += 1
        
    return {"status": "success", "reminders_sent": count}


@router.get("/candidates", response_model=list[CandidateListResponse])
async def list_all_candidates(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint: list all registered candidates with their scores."""
    result = await db.execute(
        select(Candidate)
        .order_by(desc(Candidate.created_at))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/mark-failed/{candidate_id}")
async def mark_as_failed(
    candidate_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Manually mark an interview as FAILED (e.g. if candidate abandoned).
    Triggers a notification email.
    """
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    import datetime
    candidate.status = "FAILED"
    candidate.interview_end_time = datetime.datetime.now(datetime.timezone.utc)
    
    if candidate.email:
        background_tasks.add_task(
            email_manager.send_status_update,
            email=candidate.email,
            name=candidate.name,
            status="Interview Status: FAILED / INCOMPLETE"
        )
        
    await db.commit()
    return {"status": "success", "candidate_id": candidate_id, "new_status": "FAILED"}
