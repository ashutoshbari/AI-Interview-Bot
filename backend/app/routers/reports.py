import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io

from app.database import get_db
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.services.report_gen import generate_final_report
from app.utils.pdf_export import generate_pdf_report

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{candidate_id}")
async def get_report(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Get (or generate) the final report for a candidate."""
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Return cached report if available
    if candidate.report_json:
        return json.loads(candidate.report_json)

    # Fetch all interview records
    q_result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate_id)
        .order_by(Interview.question_order)
    )
    records = q_result.scalars().all()

    if not records:
        raise HTTPException(status_code=404, detail="No interview data found for this candidate.")

    unanswered = [r for r in records if r.answer is None]
    if len(unanswered) == len(records):
        raise HTTPException(status_code=400, detail="Interview has not been started yet.")

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
    overall = report.get("overall_score", 0)
    candidate.total_score = float(overall)
    candidate.status = "completed"
    candidate.report_json = json.dumps(report)
    await db.commit()

    return report


@router.get("/{candidate_id}/pdf")
async def download_pdf_report(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Download the interview report as a PDF file."""
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not candidate.report_json:
        raise HTTPException(status_code=400, detail="Report not yet generated. Call GET /api/reports/{candidate_id} first.")

    report = json.loads(candidate.report_json)
    pdf_bytes = generate_pdf_report(
        candidate_name=candidate.name,
        position=candidate.position or "Software Engineer",
        report=report,
    )

    filename = f"interview_report_{candidate.name.replace(' ', '_')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
