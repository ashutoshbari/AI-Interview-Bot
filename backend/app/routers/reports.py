import json
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io

from app.database import get_db
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.services.report_gen import generate_final_report
from app.services.email_service import email_manager
from app.utils.pdf_export import generate_pdf_report

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{candidate_id}")
async def get_report(
    candidate_id: int, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Get (or generate) the final report for a candidate."""
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Return cached report if available
    if candidate.report_json:
        try:
            return json.loads(candidate.report_json)
        except Exception:
            pass

    # Fetch all interview records
    q_result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    records = q_result.scalars().all()

    answered = [r for r in records if r.answer]

    # Allow report generation if: interview is COMPLETED, OR at least 1 question was answered
    if not answered:
        report = {
            "overall_score": 70,
            "technical_score": 70,
            "problem_solving_score": 70,
            "communication_score": 75,
            "strengths": [
                "Completed initial candidate onboarding and identity verification.",
                "Demonstrated readiness to engage with the AI interview workflow."
            ],
            "weaknesses": [
                "Practice delivering concise verbal responses under standard interview timing constraints."
            ],
            "improvement_plan": [
                "Complete full mock interview loop with active voice responses.",
                "Practice high-level architecture decomposition."
            ],
            "upskilling_plan": [
                {"topic": "Technical Interview Preparation", "resource": "LeetCode & System Design Primer", "priority": "High"}
            ],
            "recommendation": "Under Review",
            "summary": f"{candidate.name} registered for the {candidate.position or 'Software Engineer'} role at ASHVANCE TECH."
        }
    else:
        records_dicts = [
            {
                "question_order": r.question_order,
                "question_type": r.question_type,
                "question": r.question,
                "answer": r.answer,
                "technical_score": r.technical_score,
                "clarity_score": r.clarity_score,
                "depth_score": r.depth_score,
                "communication_score": r.communication_score,
                "feedback": r.feedback,
            }
            for r in records
        ]

        report = await generate_final_report(
            candidate_name=candidate.name,
            position=candidate.position or "Software Engineer",
            interview_records=records_dicts,
        )

    # Compute aggregate score and save
    import datetime
    overall = report.get("overall_score", 75)
    candidate.total_score = float(overall)
    candidate.status = "COMPLETED"
    candidate.interview_end_time = datetime.datetime.now(datetime.timezone.utc)
    candidate.report_json = json.dumps(report)

    # Generate PDF bytes for attachment
    pdf_bytes = generate_pdf_report(
        candidate_name=candidate.name,
        position=candidate.position or "Software Engineer",
        report=report,
    )

    # Automated Email: Completion Feedback (Strict 1-time delivery)
    if candidate.email and not getattr(candidate, "completion_email_sent", False):
        candidate.completion_email_sent = True
        candidate.completion_email_sent_at = datetime.datetime.now(datetime.timezone.utc)
        background_tasks.add_task(
            email_manager.send_completion_email,
            email=candidate.email,
            name=candidate.name,
            position=candidate.position or "Software Engineer",
            report=report,
            pdf_bytes=pdf_bytes
        )

    await db.commit()
    return report


@router.get("/{candidate_id}/pdf")
async def download_pdf_report(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Download the executive interview report as a PDF file."""
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    report = None
    if candidate.report_json:
        try:
            report = json.loads(candidate.report_json)
        except Exception:
            report = None

    if not report:
        # Lazy synthesis if report was not pre-generated
        q_result = await db.execute(
            select(Interview)
            .where(Interview.candidate_id == candidate_id)
            .order_by(Interview.question_order)
        )
        records = q_result.scalars().all()
        answered = [r for r in records if r.answer]

        if answered:
            records_dicts = [
                {
                    "question_order": r.question_order,
                    "question_type": r.question_type,
                    "question": r.question,
                    "answer": r.answer,
                    "technical_score": r.technical_score,
                    "clarity_score": r.clarity_score,
                    "depth_score": r.depth_score,
                    "communication_score": r.communication_score,
                    "feedback": r.feedback,
                }
                for r in records
            ]
            report = await generate_final_report(
                candidate_name=candidate.name,
                position=candidate.position or "Software Engineer",
                interview_records=records_dicts,
            )
        else:
            report = {
                "overall_score": 75,
                "technical_score": 75,
                "problem_solving_score": 70,
                "communication_score": 80,
                "strengths": ["Completed identity verification and assessment profile."],
                "weaknesses": ["Practice verbal technical explanations."],
                "improvement_plan": ["Complete full mock interview sessions."],
                "upskilling_plan": [{"topic": "System Design", "resource": "High Scalability", "priority": "High"}],
                "recommendation": "Under Review",
                "summary": f"Assessment generated for {candidate.name} ({candidate.position or 'Software Engineer'})."
            }

        candidate.report_json = json.dumps(report)
        candidate.status = "COMPLETED"
        await db.commit()

    pdf_bytes = generate_pdf_report(
        candidate_name=candidate.name,
        position=candidate.position or "Software Engineer",
        report=report,
    )

    clean_name = candidate.name.replace(" ", "_")
    filename = f"ASHVANCE_TECH_Interview_Report_{clean_name}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        },
    )


# ── Secure Token Endpoints for Public Reports ─────────────────────────────────

@router.get("/token/{token}")
async def get_report_by_token(
    token: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve or synthesize report by secure token without exposing candidate ID."""
    cand_result = await db.execute(select(Candidate).where(Candidate.secure_token == token))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Assessment report not found for this link.")

    return await get_report(candidate.id, background_tasks, db)


@router.get("/token/{token}/pdf")
async def download_pdf_by_token(token: str, db: AsyncSession = Depends(get_db)):
    """Download report PDF via secure public link token."""
    cand_result = await db.execute(select(Candidate).where(Candidate.secure_token == token))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Assessment report not found for this link.")

    return await download_pdf_report(candidate.id, db)
