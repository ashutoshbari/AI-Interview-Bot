import os
import uuid
import json
import logging
import aiofiles
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.schemas.candidate import CandidateResponse
from app.services.resume_parser import extract_resume_text
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/candidates", tags=["candidates"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}


@router.post("/register", response_model=CandidateResponse, status_code=201)
async def register_candidate(
    name: str = Form(...),
    mobile: str = Form(...),
    position: str = Form(default="Software Engineer"),
    resume: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Register a candidate with high-verbosity logging and strict validation.
    """
    logger.info("--- Registration Attempt Started ---")
    logger.info(f"Fields received: name='{name}', mobile='{mobile}', position='{position}'")
    
    try:
        # 1. Validate name
        name = name.strip()
        if len(name) < 2:
            logger.warning(f"Registration failed: Name too short ('{name}')")
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters long.")

        # 2. Validate mobile (numeric check)
        mobile_digits = "".join(filter(str.isdigit, mobile))
        if len(mobile_digits) < 10:
            logger.warning(f"Registration failed: Invalid mobile ('{mobile}')")
            raise HTTPException(status_code=400, detail="Mobile number must contain at least 10 digits.")

        # 3. Validate resume file
        if not resume or not resume.filename:
            logger.warning("Registration failed: No resume file provided")
            raise HTTPException(status_code=400, detail="Resume file is required.")

        filename = resume.filename
        ext = Path(filename).suffix.lower()
        logger.info(f"File received: {filename} (extension: {ext}, type: {resume.content_type})")

        if ext not in ALLOWED_EXTENSIONS:
            logger.warning(f"Registration failed: Unsupported extension '{ext}'")
            raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Please upload PDF, DOC, or DOCX.")

        # Read content to check size
        content = await resume.read()
        file_size_mb = len(content) / (1024 * 1024)
        logger.info(f"File size: {file_size_mb:.2f} MB")

        if file_size_mb > settings.MAX_FILE_SIZE_MB:
            logger.warning(f"Registration failed: File too large ({file_size_mb:.2f} MB)")
            raise HTTPException(status_code=400, detail=f"File is too large ({file_size_mb:.2f}MB). Max limit is {settings.MAX_FILE_SIZE_MB}MB.")

        if len(content) == 0:
            logger.warning("Registration failed: File is empty")
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

        # 4. Save file
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        file_path = UPLOAD_DIR / unique_filename
        try:
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(content)
            logger.info(f"File saved to: {file_path}")
        except Exception as e:
            logger.error(f"File System Error: Failed to save file: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Server error: Could not save the uploaded file.")

        # 5. Extract text
        try:
            from fastapi.concurrency import run_in_threadpool
            logger.info("Starting text extraction from resume...")
            resume_text = await run_in_threadpool(extract_resume_text, str(file_path))
            logger.info(f"Text extraction successful. Length: {len(resume_text)} chars")
        except ValueError as e:
            logger.warning(f"Extraction Error: {e}")
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail=str(e))
        except Exception as e:
            logger.error(f"Unexpected Extraction Crash: {e}", exc_info=True)
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="Failed to process resume content due to a server error.")

        # 6. Create DB Record (Initial)
        try:
            from app.services.summarizer import summarize_resume
            import json
            
            logger.info("Generating candidate resume summary...")
            summary_data = await summarize_resume(resume_text)
            summary_json = json.dumps(summary_data)
            
            candidate = Candidate(
                name=name,
                mobile=mobile_digits,
                position=position.strip() or "Software Engineer",
                resume_path=str(file_path),
                resume_text=resume_text,
                resume_summary=summary_json,
                status="registered",
                last_ai_error=summary_data.get("error") if "error" in summary_data else None
            )
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)
            logger.info(f"DB Record Created: ID {candidate.id} for {candidate.name} with summary")
            return candidate
        except Exception as e:
            logger.error(f"Database/AI Error during registration: {e}", exc_info=True)
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="Server error: Registration processing failed.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CRITICAL REGISTRATION FAILURE: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during registration.")
    finally:
        logger.info("--- Registration Attempt Ended ---")


@router.get("/{candidate_id}/status")
async def get_candidate_status(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Poll status to know when questions are ready."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"status": candidate.status, "name": candidate.name}
