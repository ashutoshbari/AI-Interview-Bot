import os
import uuid
import json
import logging
import aiofiles
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.schemas.candidate import CandidateResponse
from app.schemas.otp import OTPSendResponse, OTPVerifyRequest, OTPVerifyResponse, WarningRequest, WarningResponse
from app.services.resume_parser import extract_resume_text
from app.services.email_service import email_manager
from app.services.otp_service import otp_service
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/candidates", tags=["candidates"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}


@router.post("/register", response_model=CandidateResponse, status_code=201)
async def register_candidate(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    mobile: str = Form(...),
    email: str = Form(None),
    position: str = Form(default="Software Engineer"),
    resume: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Register a candidate with fast response and async resume summarization.

    PERFORMANCE FIX: Resume summarization (AI call, 3-8s) now runs in the background
    after returning the candidate record. The registration POST returns immediately.
    """
    import re as _re
    logger.info("--- Registration Attempt Started ---")
    logger.info(f"Fields received: name='{name}', mobile='{mobile}', position='{position}'")

    try:
        # 1. Validate name
        name = name.strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters long.")

        # 2. Validate Indian mobile number
        # Accept: +91XXXXXXXXXX, 91XXXXXXXXXX, or plain 10-digit starting with 6-9
        mobile_clean = mobile.strip().replace(" ", "").replace("-", "")
        mobile_digits = _re.sub(r'^(\+91|91)', '', mobile_clean)  # strip country code
        mobile_digits = "".join(filter(str.isdigit, mobile_digits))

        if len(mobile_digits) != 10 or mobile_digits[0] not in "6789":
            logger.warning(f"Registration failed: Invalid Indian mobile ('{mobile}')")
            raise HTTPException(
                status_code=400,
                detail="Please enter a valid Indian mobile number (10 digits, starting with 6-9)."
            )
        # Normalize to +91 format
        normalized_mobile = f"+91{mobile_digits}"
        logger.info(f"Mobile normalized: {normalized_mobile}")

        # 3. Validate resume file
        if not resume or not resume.filename:
            raise HTTPException(status_code=400, detail="Resume file is required.")

        filename = resume.filename
        ext = Path(filename).suffix.lower()
        logger.info(f"File received: {filename} (extension: {ext})")

        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Please upload PDF, DOC, or DOCX."
            )

        content = await resume.read()
        file_size_mb = len(content) / (1024 * 1024)

        if file_size_mb > settings.MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=400,
                detail=f"File too large ({file_size_mb:.2f}MB). Max {settings.MAX_FILE_SIZE_MB}MB."
            )
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

        # 4. Save file
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        file_path = UPLOAD_DIR / unique_filename
        try:
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(content)
            logger.info(f"File saved to: {file_path}")
        except Exception as e:
            logger.error(f"File save error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Server error: Could not save the uploaded file.")

        # 5. Extract text from resume (fast — local PDF/DOCX parsing)
        try:
            from fastapi.concurrency import run_in_threadpool
            resume_text = await run_in_threadpool(extract_resume_text, str(file_path))
            logger.info(f"Text extracted: {len(resume_text)} chars")
        except ValueError as e:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail=str(e))
        except Exception as e:
            logger.error(f"Text extraction error: {e}", exc_info=True)
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="Failed to process resume content.")

        # 6. Save candidate to DB immediately with cryptographic secure token
        import secrets as _secrets
        from datetime import datetime as _dt, timezone as _tz, timedelta as _td
        secure_token = _secrets.token_urlsafe(32)
        token_expires_at = _dt.now(_tz.utc) + _td(days=7)

        try:
            candidate = Candidate(
                name=name,
                mobile=normalized_mobile,
                email=email,
                position=position.strip() or "Software Engineer",
                resume_path=str(file_path),
                resume_text=resume_text,
                resume_summary=None,   # Will be filled by background task
                status="NOT_STARTED",
                secure_token=secure_token,
                token_expires_at=token_expires_at,
            )
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)
            logger.info(f"✅ DB Record Created: ID={candidate.id} Token={secure_token[:8]}... Name={candidate.name}")
        except Exception as e:
            logger.error(f"DB error during registration: {e}", exc_info=True)
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="Server error: Registration DB save failed.")

        # 7. Background: Summarize resume with AI (3-8s — does NOT block response)
        async def _summarize_in_background(candidate_id: int, text: str):
            """Run resume summarization after returning response to client."""
            try:
                from app.services.summarizer import summarize_resume
                import json as _json
                from app.database import AsyncSessionLocal
                logger.info(f"[BG] Starting resume summarization for candidate {candidate_id}")
                summary_data = await summarize_resume(text)
                summary_json = _json.dumps(summary_data)
                async with AsyncSessionLocal() as bg_db:
                    bg_result = await bg_db.execute(select(Candidate).where(Candidate.id == candidate_id))
                    bg_candidate = bg_result.scalar_one_or_none()
                    if bg_candidate:
                        bg_candidate.resume_summary = summary_json
                        await bg_db.commit()
                        logger.info(f"[BG] ✅ Resume summary saved for candidate {candidate_id}")
            except Exception as exc:
                logger.error(f"[BG] Resume summarization failed for {candidate_id}: {exc}")

        background_tasks.add_task(_summarize_in_background, candidate.id, resume_text)

        return candidate

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
    return {"status": candidate.status, "name": candidate.name, "is_verified": getattr(candidate, "is_verified", False)}


@router.post("/{candidate_id}/send-otp", response_model=OTPSendResponse)
async def send_otp(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Generate and send OTP via available channels (Email/SMS)."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    try:
        channels = await otp_service.create_and_send_otp(candidate, db)
        return OTPSendResponse(message="OTP sent successfully", channels=channels)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to send OTP for candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP.")


@router.post("/{candidate_id}/verify-otp", response_model=OTPVerifyResponse)
async def verify_otp(candidate_id: int, payload: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verify the submitted OTP code."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    success, message = await otp_service.verify_otp(candidate_id, payload.otp_code, db)
    if not success:
        raise HTTPException(status_code=400, detail=message)
        
    return OTPVerifyResponse(verified=True, message=message)


@router.post("/{candidate_id}/record-warning", response_model=WarningResponse)
async def record_warning(candidate_id: int, payload: WarningRequest, db: AsyncSession = Depends(get_db)):
    """Record an anti-cheat warning (tab switch or copy-paste)."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    if payload.type == "tab_switch":
        candidate.tab_switch_count += 1
    elif payload.type == "copy_paste":
        candidate.copy_paste_count += 1
    else:
        raise HTTPException(status_code=400, detail="Invalid warning type")
        
    await db.commit()
    
    return WarningResponse(
        tab_switch_count=candidate.tab_switch_count,
        copy_paste_count=candidate.copy_paste_count
    )


# ── Secure Token Endpoints for Public Deep Links ──────────────────────────────

@router.get("/token/{token}")
async def get_candidate_by_token(token: str, db: AsyncSession = Depends(get_db)):
    """Resolve a secure public interview token, validating state and expiration."""
    from datetime import datetime as _dt, timezone as _tz

    result = await db.execute(select(Candidate).where(Candidate.secure_token == token))
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(
            status_code=404,
            detail="This interview link is no longer valid or does not exist."
        )

    # Check expiration
    if candidate.token_expires_at:
        now = _dt.now(_tz.utc)
        exp = candidate.token_expires_at if candidate.token_expires_at.tzinfo else candidate.token_expires_at.replace(tzinfo=_tz.utc)
        if now > exp:
            raise HTTPException(
                status_code=410,
                detail="This interview link has expired. Please contact your hiring manager for a new link."
            )

    return {
        "valid": True,
        "candidate_id": candidate.id,
        "secure_token": candidate.secure_token,
        "name": candidate.name,
        "email": candidate.email,
        "mobile": candidate.mobile,
        "position": candidate.position,
        "status": candidate.status,
        "is_verified": candidate.is_verified,
        "current_stage": candidate.current_stage or "greeting",
        "is_completed": candidate.status == "COMPLETED",
        "created_at": candidate.created_at,
    }


@router.post("/token/{token}/verify-otp")
async def verify_otp_by_token(
    token: str,
    payload: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verify OTP directly via the candidate's secure token."""
    result = await db.execute(select(Candidate).where(Candidate.secure_token == token))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Interview link not found")

    success, message = await otp_service.verify_otp(candidate.id, payload.otp_code, db)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    return {"verified": True, "message": message, "candidate_id": candidate.id}
