"""
Interview router — handles:
  • GET  /{candidate_id}/questions  → fetch / generate the next question
  • POST /{candidate_id}/answer     → evaluate answer, generate next question
  • POST /transcribe                → convert audio to text
  • GET  /{candidate_id}/records    → full interview transcript
"""

import logging
import os
import tempfile
import datetime

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.schemas.interview import (
    QuestionResponse, AnswerSubmit, EvaluationResponse,
    InterviewRecord, TranscriptionResponse,
)
from app.services.evaluator import evaluate_answer
from app.services.question_gen import generate_next_question
from app.services.transcriber import transcribe_audio
from app.services.email_service import email_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/interviews", tags=["interviews"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _now_utc():
    return datetime.datetime.now(datetime.timezone.utc)


def _send_interviewer_alert_bg(
    event: str,
    candidate: Candidate,
    extra: dict | None = None,
):
    """Fire-and-forget HR alert (called via background_tasks)."""
    try:
        email_manager.send_interviewer_alert(
            event=event,
            candidate_name=candidate.name,
            candidate_email=candidate.email or "",
            position=candidate.position or "Software Engineer",
            extra=extra,
        )
    except Exception as exc:
        logger.error(f"Interviewer alert failed silently: {exc}")


# ── GET /questions ─────────────────────────────────────────────────────────────

@router.get("/{candidate_id}/questions", response_model=list[QuestionResponse])
async def get_questions(
    candidate_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Return the current active question (or generate the first one)."""

    # 1. Load candidate
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 2. Check Verification (OTP Guard)
    if not getattr(candidate, "is_verified", False):
        raise HTTPException(
            status_code=403, 
            detail="Identity not verified. Please complete OTP verification first."
        )

    # 3. First-time access → mark IN_PROGRESS and notify
    if candidate.status in ("NOT_STARTED", "registered", None):
        candidate.status = "IN_PROGRESS"
        try:
            candidate.interview_start_time = _now_utc()
        except Exception:
            pass  # column might not exist in older DBs — handle gracefully
        try:
            await db.commit()
        except Exception as exc:
            logger.error(f"Failed to update candidate status: {exc}")
            await db.rollback()

        # Emails: candidate + interviewer
        if candidate.email:
            background_tasks.add_task(
                email_manager.send_interview_started,
                email=candidate.email,
                name=candidate.name,
                position=candidate.position or "Software Engineer",
            )
        background_tasks.add_task(
            _send_interviewer_alert_bg,
            "STARTED",
            candidate,
        )
        logger.info(f"Interview STARTED for candidate {candidate_id} ({candidate.name})")

    # 3. Load existing questions
    q_result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    records = q_result.scalars().all()

    # 4. No questions yet → generate the first one
    if not records:
        next_q_data = await generate_next_question(candidate, [])
        if "error" in next_q_data:
            raise HTTPException(status_code=503, detail=next_q_data["error"])

        question_text = next_q_data.get("question")
        if not question_text:
            question_text = (
                f"Welcome {candidate.name}! I've reviewed your profile. "
                "Could you please start by giving me a brief introduction of yourself?"
            )

        first_q = Interview(
            candidate_id=candidate_id,
            question_order=1,
            question_type=next_q_data.get("type", "introduction"),
            stage=next_q_data.get("stage", "greeting"),
            question=question_text,
        )
        db.add(first_q)
        try:
            await db.commit()
        except Exception as exc:
            logger.error(f"Failed to save first question: {exc}")
            await db.rollback()
            raise HTTPException(status_code=500, detail="Failed to save question to database.")
        records = [first_q]

    # 5. Return the first unanswered question (or last if all answered)
    active_qs = [r for r in records if r.answer is None]
    if not active_qs:
        active_qs = [records[-1]]

    return [
        QuestionResponse(
            question_order=r.question_order,
            question_type=r.question_type or "general",
            stage=r.stage or "greeting",
            question=r.question,
        )
        for r in active_qs[:1]
    ]


# ── POST /answer ───────────────────────────────────────────────────────────────

@router.post("/{candidate_id}/answer", response_model=EvaluationResponse)
async def submit_answer(
    candidate_id: int,
    payload: AnswerSubmit,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Evaluate the submitted answer and generate the next question."""

    # 1. Load candidate
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 2. Load the question record
    q_result = await db.execute(
        select(Interview).where(
            Interview.candidate_id == candidate_id,
            Interview.question_order == payload.question_order,
        )
    )
    interview_record = q_result.scalar_one_or_none()
    if not interview_record:
        raise HTTPException(
            status_code=404,
            detail=f"Question {payload.question_order} not found. Please refresh the page.",
        )

    # 3. Evaluate the answer
    try:
        evaluation = await evaluate_answer(interview_record.question, payload.answer)
    except Exception as exc:
        logger.error(f"Evaluation crashed: {exc}", exc_info=True)
        evaluation = {
            "technical_score": 5.0, "clarity_score": 5.0,
            "depth_score": 5.0, "communication_score": 5.0,
            "feedback": "Evaluation temporarily unavailable. Score will be updated.",
            "is_follow_up_needed": False, "suggested_follow_up": None,
        }

    # 4. Persist the answer + scores
    interview_record.answer = payload.answer
    interview_record.technical_score = evaluation.get("technical_score", 5.0)
    interview_record.clarity_score = evaluation.get("clarity_score", 5.0)
    interview_record.depth_score = evaluation.get("depth_score", 5.0)
    interview_record.communication_score = evaluation.get("communication_score", 5.0)
    interview_record.feedback = evaluation.get("feedback", "")

    # 5. Load full history (including current answer in-memory)
    history_result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    history = list(history_result.scalars().all())

    # Inject the just-answered record into history so next question is contextual
    for h in history:
        if h.question_order == payload.question_order:
            h.answer = payload.answer  # ensure it's visible even before commit
            break

    # 6. Generate next question
    try:
        next_q_data = await generate_next_question(candidate, history)
    except Exception as exc:
        logger.error(f"generate_next_question crashed: {exc}", exc_info=True)
        next_q_data = {"error": str(exc)}

    is_complete = next_q_data.get("is_interview_complete", False)

    # If we hit the max question count, force completion
    if len(history) >= 15:
        is_complete = True

    next_q = None
    if not is_complete and "error" not in next_q_data:
        new_stage = next_q_data.get("stage", getattr(candidate, "current_stage", "technical"))
        question_text = next_q_data.get("question")
        if not question_text:
            question_text = "Can you elaborate on one of the projects you mentioned earlier?"

        next_q_record = Interview(
            candidate_id=candidate_id,
            question_order=payload.question_order + 1,
            question_type=next_q_data.get("type", "general"),
            stage=new_stage,
            question=question_text,
        )
        db.add(next_q_record)

        try:
            candidate.current_stage = new_stage
        except Exception:
            pass  # graceful for older DB schemas

        next_q = QuestionResponse(
            question_order=next_q_record.question_order,
            question_type=next_q_record.question_type,
            stage=next_q_record.stage,
            question=next_q_record.question,
        )

    elif "error" in next_q_data and not is_complete:
        # AI error generating next question — commit the answer but surface the error
        await db.commit()
        raise HTTPException(
            status_code=503,
            detail=f"Answer saved. Could not generate next question: {next_q_data['error']}"
        )

    # 7. Update candidate status
    old_status = candidate.status
    if is_complete:
        candidate.status = "COMPLETED"
        try:
            candidate.interview_end_time = _now_utc()
        except Exception:
            pass
    elif candidate.status not in ("IN_PROGRESS", "COMPLETED"):
        candidate.status = "IN_PROGRESS"

    # 8. Persist everything
    try:
        await db.commit()
    except Exception as exc:
        logger.error(f"DB commit failed in submit_answer: {exc}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error saving your answer.")

    # 9. Post-completion emails
    if is_complete and old_status != "COMPLETED":
        logger.info(f"Interview COMPLETED for candidate {candidate_id} ({candidate.name})")

        # Try to get overall score from the report (best-effort)
        avg_score = None
        try:
            all_scores = [
                h.technical_score for h in history
                if h.technical_score is not None
            ]
            if all_scores:
                avg_score = round((sum(all_scores) / len(all_scores)) * 10, 1)
        except Exception:
            pass

        if candidate.email:
            background_tasks.add_task(
                email_manager.send_interview_completed,
                email=candidate.email,
                name=candidate.name,
                position=candidate.position or "Software Engineer",
                overall_score=avg_score,
            )

        background_tasks.add_task(
            _send_interviewer_alert_bg,
            "COMPLETED",
            candidate,
            {"overall_score": avg_score, "recommendation": "Pending Review", "q_count": len(history)},
        )

    return EvaluationResponse(
        technical_score=evaluation.get("technical_score", 5.0),
        clarity_score=evaluation.get("clarity_score", 5.0),
        depth_score=evaluation.get("depth_score", 5.0),
        communication_score=evaluation.get("communication_score", 5.0),
        feedback=evaluation.get("feedback", ""),
        next_question=next_q,
        interview_complete=is_complete,
    )


# ── POST /transcribe ───────────────────────────────────────────────────────────

@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(audio: UploadFile = File(...)):
    """Transcribe an uploaded audio file using Whisper."""
    MAX_SIZE = 10 * 1024 * 1024  # 10 MB
    content = await audio.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file received.")
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Audio file too large (max 10 MB).")

    suffix = os.path.splitext(audio.filename or "audio")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name

    try:
        async with aiofiles.open(tmp_path, "wb") as f:
            await f.write(content)

        text = await transcribe_audio(tmp_path)
        if not text or text.strip() == "":
            raise HTTPException(status_code=400, detail="Transcription is empty. Please speak clearly and try again.")
        return TranscriptionResponse(text=text)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ── GET /records ───────────────────────────────────────────────────────────────

@router.get("/{candidate_id}/records", response_model=list[InterviewRecord])
async def get_interview_records(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Return the full Q&A transcript for a candidate."""
    result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    return result.scalars().all()
