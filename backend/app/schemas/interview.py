from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class QuestionResponse(BaseModel):
    question_order: int
    question_type: str
    stage: str
    question: str


class AnswerSubmit(BaseModel):
    question_order: int = Field(..., ge=0)
    answer: str = Field(..., min_length=1)


class EvaluationResponse(BaseModel):
    technical_score: float
    clarity_score: float
    depth_score: float
    communication_score: float
    feedback: str
    is_follow_up: bool = False
    follow_up_query: Optional[str] = None
    next_question: Optional[QuestionResponse] = None
    interview_complete: bool = False


class TranscriptionResponse(BaseModel):
    text: str


class ClarifyRequest(BaseModel):
    current_question: str
    user_query: str = Field(..., min_length=1)


class ClarifyResponse(BaseModel):
    ai_response: str


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)


# ── Suggestions / Coaching Report ─────────────────────────────────────────────

class StrengthItem(BaseModel):
    title: str
    detail: str


class GrowthArea(BaseModel):
    title: str
    detail: str


class RoadmapItem(BaseModel):
    week: str
    focus: str
    action: str
    resource: str


class SuggestionsResponse(BaseModel):
    overall_score: float
    verdict: str  # "Strong Hire" | "Hire" | "Needs Improvement" | "No Hire"
    verdict_reason: str
    top_strengths: List[Any] = []
    growth_areas: List[Any] = []
    quick_wins: List[str] = []
    coaching_roadmap: List[Any] = []
    interview_style_tips: List[str] = []
    encouragement: str = ""


# ── Interview Records ─────────────────────────────────────────────────────────

class InterviewRecord(BaseModel):
    id: int
    candidate_id: int
    question_order: int
    question_type: Optional[str]
    stage: Optional[str]
    question: str
    answer: Optional[str]
    technical_score: Optional[float]
    clarity_score: Optional[float]
    depth_score: Optional[float]
    communication_score: Optional[float]
    feedback: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
