import logging
import os
import tempfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.schemas.interview import QuestionResponse, AnswerSubmit, EvaluationResponse, InterviewRecord, TranscriptionResponse
from app.services.evaluator import evaluate_answer
from app.services.question_gen import generate_next_question
from app.services.transcriber import transcribe_audio
from app.services.email_service import email_manager

router = APIRouter(prefix="/api/interviews", tags=["interviews"])

@router.get("/{candidate_id}/questions", response_model=list[QuestionResponse])
async def get_questions(
    candidate_id: int, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Return the current active question or generate the first one."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # 1. Update status to IN_PROGRESS on first access
    if candidate.status == "NOT_STARTED":
        import datetime
        candidate.status = "IN_PROGRESS"
        candidate.interview_start_time = datetime.datetime.now(datetime.timezone.utc)
        await db.commit()
        
        if candidate.email:
            background_tasks.add_task(
                email_manager.send_status_update,
                email=candidate.email,
                name=candidate.name,
                status="Interview Started (IN_PROGRESS)"
            )

    # 2. Check if we have any questions yet
    q_result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    records = q_result.scalars().all()
    
    if not records:
        # Generate the first question (Greeting)
        next_q_data = await generate_next_question(candidate, [])
        if "error" in next_q_data:
            raise HTTPException(status_code=503, detail=next_q_data["error"])
            
        first_q = Interview(
            candidate_id=candidate_id,
            question_order=1,
            question_type=next_q_data.get("type", "introduction"),
            stage=next_q_data.get("stage", "greeting"),
            question=next_q_data.get("question")
        )
        db.add(first_q)
        await db.commit()
        records = [first_q]

    # Return only the questions that haven't been answered yet, or the last asked one
    active_qs = [r for r in records if r.answer is None]
    if not active_qs:
        # All answered? This shouldn't happen via GET /questions usually
        active_qs = [records[-1]]

    return [
        QuestionResponse(
            question_order=r.question_order,
            question_type=r.question_type or "general",
            stage=r.stage or "greeting",
            question=r.question,
        )
        for r in active_qs[:1] # Only return one active question at a time
    ]


@router.post("/{candidate_id}/answer", response_model=EvaluationResponse)
async def submit_answer(
    candidate_id: int,
    payload: AnswerSubmit,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Submit an answer, evaluate it, and generate the next question dynamically."""
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    q_result = await db.execute(
        select(Interview).where(
            Interview.candidate_id == candidate_id,
            Interview.question_order == payload.question_order,
        )
    )
    interview_record = q_result.scalar_one_or_none()
    if not interview_record:
        raise HTTPException(status_code=404, detail=f"Question {payload.question_order} not found")

    # Evaluate
    evaluation = await evaluate_answer(interview_record.question, payload.answer)

    # Update record
    interview_record.answer = payload.answer
    interview_record.technical_score = evaluation["technical_score"]
    interview_record.clarity_score = evaluation["clarity_score"]
    interview_record.depth_score = evaluation["depth_score"]
    interview_record.communication_score = evaluation["communication_score"]
    interview_record.feedback = evaluation["feedback"]

    # Generate NEXT question dynamically
    # Get all history for context
    history_result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    history = history_result.scalars().all()
    
    next_q_data = await generate_next_question(candidate, history)
    
    if "error" in next_q_data:
        # Don't commit the answer if we can't get the next question?
        # Actually, maybe better to commit the answer and let the user retry GET /questions
        await db.commit() 
        raise HTTPException(status_code=503, detail=next_q_data["error"])

    is_complete = next_q_data.get("is_interview_complete", False)
    next_q = None

    if not is_complete:
        new_stage = next_q_data.get("stage", candidate.current_stage)
        candidate.current_stage = new_stage
        
        next_q_record = Interview(
            candidate_id=candidate_id,
            question_order=payload.question_order + 1,
            question_type=next_q_data.get("type", "general"),
            stage=new_stage,
            question=next_q_data.get("question")
        )
        db.add(next_q_record)
        
        next_q = QuestionResponse(
            question_order=next_q_record.question_order,
            question_type=next_q_record.question_type,
            stage=next_q_record.stage,
            question=next_q_record.question
        )

    old_status = candidate.status
    if candidate.status == "questions_ready" or candidate.status == "registered":
        candidate.status = "in_progress"
    
    if is_complete:
        candidate.status = "completed"

    if old_status != candidate.status and candidate.email:
        background_tasks.add_task(
            email_manager.send_status_update,
            email=candidate.email,
            name=candidate.name,
            status=f"Interview Status: {candidate.status}"
        )

    await db.commit()

    return EvaluationResponse(
        technical_score=evaluation["technical_score"],
        clarity_score=evaluation["clarity_score"],
        depth_score=evaluation["depth_score"],
        communication_score=evaluation["communication_score"],
        feedback=evaluation["feedback"],
        next_question=next_q,
        interview_complete=is_complete,
    )


import aiofiles

@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(audio: UploadFile = File(...)):
    """Transcribe uploaded audio file with validation."""
    # Size validation (10MB)
    MAX_SIZE = 10 * 1024 * 1024
    content = await audio.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file received.")
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Audio file too large (max 10MB).")

    suffix = os.path.splitext(audio.filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name

    try:
        async with aiofiles.open(tmp_path, "wb") as f:
            await f.write(content)
            
        text = await transcribe_audio(tmp_path)
        if not text or text.strip() == "":
            raise HTTPException(status_code=400, detail="Transcription result is empty. Please speak clearly.")
        return TranscriptionResponse(text=text)
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.get("/{candidate_id}/records", response_model=list[InterviewRecord])
async def get_interview_records(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Get all records for a candidate."""
    result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    return result.scalars().all()
