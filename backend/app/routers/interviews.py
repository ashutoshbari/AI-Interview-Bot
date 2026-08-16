"""
Interview router — handles:
  • GET  /{candidate_id}/questions       → fetch / generate the next question
  • POST /{candidate_id}/answer          → evaluate answer, generate next question
  • GET  /{candidate_id}/next-question   → safe polling fallback for next question
  • POST /{candidate_id}/clarify         → two-way AI conversation
  • POST /{candidate_id}/finish          → submit and complete interview
  • GET  /{candidate_id}/suggestions     → post-interview AI coaching suggestions
  • POST /transcribe                     → convert audio to text (fallback)
  • POST /tts                            → text-to-female-voice audio stream
  • GET  /{candidate_id}/records         → full interview transcript
"""

import logging
import os
import json
import datetime
import tempfile
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import AsyncOpenAI

from app.database import get_db
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.schemas.interview import (
    QuestionResponse, AnswerSubmit, EvaluationResponse,
    InterviewRecord, TranscriptionResponse, ClarifyRequest, ClarifyResponse,
    TTSRequest, SuggestionsResponse,
)
from app.services.evaluator import evaluate_answer
from app.services.question_gen import generate_next_question
from app.services.transcriber import transcribe_audio
from app.services.tts_service import synthesize_speech
from app.services.email_service import email_manager
from app.utils.ai_utils import openai_safe_call
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/interviews", tags=["interviews"])

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY or "placeholder")


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

        # Status updated to IN_PROGRESS
        logger.info(f"Interview STARTED for candidate {candidate_id} ({candidate.name})")

    # 4. Load existing questions
    q_result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    records = q_result.scalars().all()

    # 5. No questions yet → generate the first one
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

    # 6. Return the first unanswered question (or last if all answered)
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


# ── GET /next-question (safe polling fallback) ─────────────────────────────────

@router.get("/{candidate_id}/next-question", response_model=QuestionResponse | None)
async def get_next_question_poll(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Safe polling fallback. Returns the current unanswered question.
    Frontend can call this after submitting an answer to get the next question
    if the POST /answer response was lost or state got out of sync.
    """
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status == "COMPLETED":
        return None  # Interview finished

    q_result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    records = q_result.scalars().all()

    active_qs = [r for r in records if r.answer is None]
    if not active_qs:
        return None  # All answered — interview complete

    r = active_qs[0]
    return QuestionResponse(
        question_order=r.question_order,
        question_type=r.question_type or "general",
        stage=r.stage or "greeting",
        question=r.question,
    )


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

    # 2. Guard: already completed
    if candidate.status == "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Interview is already completed. View your report."
        )

    # 3. Load the question record
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

    # 4. Guard: already answered (idempotency)
    if interview_record.answer:
        logger.warning(f"Q{payload.question_order} already answered for candidate {candidate_id} — skipping re-evaluation")
        # Still generate next question response so frontend can advance
        next_q_result = await db.execute(
            select(Interview).where(
                Interview.candidate_id == candidate_id,
                Interview.question_order == payload.question_order + 1,
            )
        )
        next_q_record = next_q_result.scalar_one_or_none()
        next_q = None
        if next_q_record:
            next_q = QuestionResponse(
                question_order=next_q_record.question_order,
                question_type=next_q_record.question_type or "general",
                stage=next_q_record.stage or "technical",
                question=next_q_record.question,
            )
        return EvaluationResponse(
            technical_score=interview_record.technical_score or 5.0,
            clarity_score=interview_record.clarity_score or 5.0,
            depth_score=interview_record.depth_score or 5.0,
            communication_score=interview_record.communication_score or 5.0,
            feedback=interview_record.feedback or "Already evaluated.",
            next_question=next_q,
            interview_complete=(candidate.status == "COMPLETED"),
        )

    # 5. Evaluate the answer
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

    # 6. Persist the answer + scores
    interview_record.answer = payload.answer
    interview_record.technical_score = evaluation.get("technical_score", 5.0)
    interview_record.clarity_score = evaluation.get("clarity_score", 5.0)
    interview_record.depth_score = evaluation.get("depth_score", 5.0)
    interview_record.communication_score = evaluation.get("communication_score", 5.0)
    interview_record.feedback = evaluation.get("feedback", "")

    # 7. Load full history (including current answer in-memory)
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

    # 8. Generate next question
    try:
        next_q_data = await generate_next_question(candidate, history)
    except Exception as exc:
        logger.error(f"generate_next_question crashed: {exc}", exc_info=True)
        next_q_data = {"error": str(exc)}

    is_complete = next_q_data.get("is_interview_complete", False)

    # If we hit the configured max question count, force completion
    max_qs = getattr(settings, "QUESTIONS_PER_INTERVIEW", 12)
    if len([h for h in history if h.answer]) >= max_qs:
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
        try:
            await db.commit()
        except Exception:
            await db.rollback()
        raise HTTPException(
            status_code=503,
            detail=f"Answer saved. Could not generate next question: {next_q_data['error']}"
        )

    # 9. Update candidate status
    old_status = candidate.status
    if is_complete:
        candidate.status = "COMPLETED"
        try:
            candidate.interview_end_time = _now_utc()
        except Exception:
            pass
    elif candidate.status not in ("IN_PROGRESS", "COMPLETED"):
        candidate.status = "IN_PROGRESS"

    # 10. Persist everything
    try:
        await db.commit()
    except Exception as exc:
        logger.error(f"DB commit failed in submit_answer: {exc}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error saving your answer.")

    # 11. Mark completed
    if is_complete and old_status != "COMPLETED":
        logger.info(f"Interview COMPLETED for candidate {candidate_id} ({candidate.name})")

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
    """Transcribe an uploaded audio file using Gemini (fallback for browsers without Web Speech API)."""
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


# ── POST /tts ──────────────────────────────────────────────────────────────────

@router.post("/tts")
async def text_to_speech(payload: TTSRequest):
    """
    Convert text to a sweet female voice audio stream (MP3).
    Used by frontend to play AI questions and clarifications in voice mode.
    """
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    # Truncate very long texts to avoid TTS overload
    text = payload.text.strip()[:1000]

    try:
        audio_bytes = await synthesize_speech(text)
        return StreamingResponse(
            iter([audio_bytes]),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=response.mp3",
                "Cache-Control": "no-cache",
            },
        )
    except Exception as e:
        logger.error(f"TTS failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")


# ── POST /clarify ──────────────────────────────────────────────────────────────

@router.post("/{candidate_id}/clarify", response_model=ClarifyResponse)
async def clarify_question(
    candidate_id: int,
    payload: ClarifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Two-way conversation: Candidate asks clarifying questions to the AI interviewer.
    AI interviewer responds naturally, warmly, and constructively in real time.
    """
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    prompt = f"""You are a professional, warm, encouraging, and friendly senior technical interviewer having a live person-to-person conversation with candidate {candidate.name} applying for {candidate.position or 'Software Engineer'}.

The current interview question is:
"{payload.current_question}"

The candidate is asking you this question or requesting clarification:
"{payload.user_query}"

Respond directly to the candidate in a helpful, warm, natural speaking tone (1-3 sentences maximum). Clarify their doubt, validate their reasoning if appropriate, and invite them to continue. Return ONLY a valid JSON object:
{{
  "ai_response": "..."
}}
"""
    result = await openai_safe_call(
        client.chat.completions.create,
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are a professional, friendly technical interviewer conversing live with a candidate. Return JSON only."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=300,
        response_format={"type": "json_object"}
    )

    if result.get("error") or not result.get("data"):
        return ClarifyResponse(
            ai_response="Great question! Yes, feel free to make standard production assumptions and proceed with your best architectural approach."
        )

    try:
        content = result["data"].choices[0].message.content.strip()
        data = json.loads(content)
        return ClarifyResponse(ai_response=data.get("ai_response", "Certainly! Please proceed with that assumption."))
    except Exception:
        return ClarifyResponse(
            ai_response="That is a very valid point. You may proceed based on that premise!"
        )


# ── POST /finish ──────────────────────────────────────────────────────────────

@router.post("/{candidate_id}/finish")
async def finish_interview(
    candidate_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Explicitly submit and finish the interview, updating status and triggering report emails."""
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status == "COMPLETED":
        return {"status": "already_completed", "message": "Interview was already submitted.", "candidate_id": candidate_id}

    candidate.status = "COMPLETED"
    candidate.interview_end_time = _now_utc()

    # Calculate overall score from answered questions
    q_result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    records = list(q_result.scalars().all())
    answered = [r for r in records if r.answer]

    avg_score = None
    if answered:
        all_scores = [r.technical_score for r in answered if r.technical_score is not None]
        if all_scores:
            avg_score = round((sum(all_scores) / len(all_scores)) * 10, 1)
        candidate.total_score = avg_score

    await db.commit()

    return {
        "status": "success",
        "message": "Interview submitted and finalized successfully.",
        "candidate_id": candidate_id,
        "questions_answered": len(answered),
        "overall_score": avg_score,
    }


# ── GET /suggestions ─────────────────────────────────────────────────────────

@router.get("/{candidate_id}/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate personalized AI coaching suggestions based on complete interview performance.
    Returns actionable improvement tips, strengths, and a learning roadmap.
    Called after interview is completed, used on the report/scorecard page.
    """
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    q_result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    records = list(q_result.scalars().all())
    answered = [r for r in records if r.answer]

    if not answered:
        raise HTTPException(status_code=400, detail="No answered questions found. Complete the interview first.")

    # Build interview summary for AI
    interview_summary = ""
    for r in answered:
        tech = r.technical_score or 0
        clarity = r.clarity_score or 0
        depth = r.depth_score or 0
        comm = r.communication_score or 0
        interview_summary += (
            f"\nQ{r.question_order} [{(r.question_type or 'general').upper()}]: {r.question}\n"
            f"Answer: {(r.answer or '')[:500]}\n"
            f"Scores — Tech: {tech:.1f}/10 | Clarity: {clarity:.1f}/10 | Depth: {depth:.1f}/10 | Comm: {comm:.1f}/10\n"
            f"Feedback: {r.feedback or 'N/A'}\n---"
        )

    # Overall score calculation
    all_tech = [r.technical_score for r in answered if r.technical_score is not None]
    all_clarity = [r.clarity_score for r in answered if r.clarity_score is not None]
    all_depth = [r.depth_score for r in answered if r.depth_score is not None]
    all_comm = [r.communication_score for r in answered if r.communication_score is not None]

    avg_tech = round(sum(all_tech) / len(all_tech), 1) if all_tech else 5.0
    avg_clarity = round(sum(all_clarity) / len(all_clarity), 1) if all_clarity else 5.0
    avg_depth = round(sum(all_depth) / len(all_depth), 1) if all_depth else 5.0
    avg_comm = round(sum(all_comm) / len(all_comm), 1) if all_comm else 5.0
    overall = round((avg_tech * 0.35 + avg_clarity * 0.25 + avg_depth * 0.25 + avg_comm * 0.15) * 10, 1)

    suggestions_prompt = f"""You are a world-class career coach and senior technical interviewer with 20+ years of experience at top tech companies (Google, Meta, Amazon).

Candidate: {candidate.name}
Position: {candidate.position or 'Software Engineer'}
Questions Answered: {len(answered)}
Average Scores — Technical: {avg_tech}/10 | Clarity: {avg_clarity}/10 | Depth: {avg_depth}/10 | Communication: {avg_comm}/10
Overall Score: {overall}/100

Complete Interview Data:
{interview_summary[:6000]}

Based on this real interview performance, generate a HIGHLY PERSONALIZED coaching report.
Be specific. Reference their actual answers and scores. Be constructive and encouraging.

Return ONLY valid JSON:
{{
  "overall_score": {overall},
  "verdict": "Strong Hire | Hire | Needs Improvement | No Hire",
  "verdict_reason": "1 sentence explaining the verdict",
  "top_strengths": [
    {{"title": "Strength name", "detail": "Specific example from their interview"}}
  ],
  "growth_areas": [
    {{"title": "Area name", "detail": "What they did and how to improve specifically"}}
  ],
  "quick_wins": ["Actionable tip 1", "Actionable tip 2", "Actionable tip 3"],
  "coaching_roadmap": [
    {{
      "week": "Week 1-2",
      "focus": "Topic based on their weakness",
      "action": "Specific action to take",
      "resource": "Specific book, course, or article name"
    }}
  ],
  "interview_style_tips": [
    "Tip about how they communicate",
    "Tip about answer structure (STAR method etc.)",
    "Tip about confidence/pacing"
  ],
  "encouragement": "A warm, personalized 2-sentence message to the candidate"
}}
"""

    result = await openai_safe_call(
        client.chat.completions.create,
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are a world-class career coach. Return only valid JSON."},
            {"role": "user", "content": suggestions_prompt}
        ],
        temperature=0.5,
        max_tokens=2000,
        response_format={"type": "json_object"}
    )

    if result.get("error") or not result.get("data"):
        # Return meaningful fallback
        return SuggestionsResponse(
            overall_score=overall,
            verdict="Hire" if overall >= 65 else "Needs Improvement",
            verdict_reason="Based on your interview performance across all dimensions.",
            top_strengths=[{"title": "Completed Interview", "detail": "You completed all interview rounds successfully."}],
            growth_areas=[{"title": "Technical Depth", "detail": "Continue deepening your knowledge of core technical concepts."}],
            quick_wins=["Practice answering in the STAR format", "Review system design fundamentals", "Work on concise communication"],
            coaching_roadmap=[{"week": "Week 1-2", "focus": "Technical fundamentals", "action": "Review core concepts", "resource": "LeetCode, System Design Primer"}],
            interview_style_tips=["Structure answers with STAR method", "Be concise and specific", "Show enthusiasm for the role"],
            encouragement=f"Great job completing the interview, {candidate.name}! Keep practicing and you'll continue to improve."
        )

    try:
        content = result["data"].choices[0].message.content.strip()
        data = json.loads(content)
        return SuggestionsResponse(
            overall_score=data.get("overall_score", overall),
            verdict=data.get("verdict", "Hire"),
            verdict_reason=data.get("verdict_reason", ""),
            top_strengths=data.get("top_strengths", []),
            growth_areas=data.get("growth_areas", []),
            quick_wins=data.get("quick_wins", []),
            coaching_roadmap=data.get("coaching_roadmap", []),
            interview_style_tips=data.get("interview_style_tips", []),
            encouragement=data.get("encouragement", f"Well done, {candidate.name}! Keep improving every day."),
        )
    except Exception as e:
        logger.error(f"Suggestions parse error: {e}")
        return SuggestionsResponse(
            overall_score=overall,
            verdict="Hire" if overall >= 65 else "Needs Improvement",
            verdict_reason="Based on aggregated scores from your interview.",
            top_strengths=[],
            growth_areas=[],
            quick_wins=["Practice daily", "Review feedback", "Keep improving"],
            coaching_roadmap=[],
            interview_style_tips=[],
            encouragement=f"Well done, {candidate.name}! Every interview is a learning experience.",
        )


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


# ── Secure Token Endpoints for Public Interviews ──────────────────────────────

@router.get("/token/{token}/questions", response_model=list[QuestionResponse])
async def get_questions_by_token(
    token: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve or generate active question by secure token."""
    cand_result = await db.execute(select(Candidate).where(Candidate.secure_token == token))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Interview link not found")
    return await get_questions(candidate.id, background_tasks, db)


@router.post("/token/{token}/answer", response_model=EvaluationResponse)
async def submit_answer_by_token(
    token: str,
    payload: AnswerSubmit,
    db: AsyncSession = Depends(get_db)
):
    """Submit candidate response and evaluate by secure token."""
    cand_result = await db.execute(select(Candidate).where(Candidate.secure_token == token))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Interview link not found")
    return await submit_answer(candidate.id, payload, db)


@router.post("/token/{token}/clarify")
async def clarify_question_by_token(
    token: str,
    payload: ClarifyRequest,
    db: AsyncSession = Depends(get_db)
):
    """Clarify question by secure token."""
    cand_result = await db.execute(select(Candidate).where(Candidate.secure_token == token))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Interview link not found")
    return await clarify_question(candidate.id, payload, db)


@router.post("/token/{token}/finish")
async def finish_interview_by_token(
    token: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Conclude interview by secure token."""
    cand_result = await db.execute(select(Candidate).where(Candidate.secure_token == token))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Interview link not found")
    return await finish_interview(candidate.id, background_tasks, db)
