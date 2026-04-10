import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models.candidate import Candidate
from app.schemas.candidate import CandidateListResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


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
