from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CandidateCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    mobile: str = Field(..., min_length=10, max_length=20)
    position: Optional[str] = None


class CandidateResponse(BaseModel):
    id: int
    name: str
    mobile: str
    position: Optional[str]
    status: str
    resume_summary: Optional[str] = None
    current_stage: Optional[str] = None
    last_ai_error: Optional[str] = None
    total_score: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateListResponse(BaseModel):
    id: int
    name: str
    mobile: str
    position: Optional[str]
    status: str
    resume_summary: Optional[str] = None
    current_stage: Optional[str] = None
    last_ai_error: Optional[str] = None
    total_score: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True
