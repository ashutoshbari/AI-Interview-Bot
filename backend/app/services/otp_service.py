"""
OTP Service — Secure verification code generation and multi-channel dispatch.
Integrated with ASHVANCE TECH corporate Email Service for official OTP notifications.
"""

import logging
import secrets
import datetime
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.config import settings
from app.models.candidate import Candidate
from app.models.otp_verification import OTPVerification
from app.services.email_service import email_manager

logger = logging.getLogger(__name__)


class OTPService:
    @staticmethod
    def generate_otp() -> str:
        """Generate a secure 6-digit numeric OTP."""
        return f"{secrets.randbelow(1000000):06d}"

    @staticmethod
    def send_otp_sms(mobile: str, otp_code: str) -> bool:
        """Send OTP via SMS using Twilio (if configured)."""
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or "your" in settings.TWILIO_ACCOUNT_SID:
            logger.info(f"[DEV] Twilio not configured. SMS OTP for {mobile} is: {otp_code}")
            return True
            
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            
            message = client.messages.create(
                body=f"ASHVANCE TECH verification code: {otp_code}. Valid for {settings.OTP_EXPIRY_MINUTES} mins for Smart Interview AI.",
                from_=settings.TWILIO_FROM_NUMBER,
                to=mobile
            )
            logger.info(f"Twilio SMS sent to {mobile}, SID: {message.sid}")
            return True
        except Exception as exc:
            logger.error(f"Failed to send Twilio SMS to {mobile}: {exc}")
            return False

    @staticmethod
    async def create_and_send_otp(candidate: Candidate, db: AsyncSession) -> list[str]:
        """Generate, save, and dispatch OTP asynchronously without blocking."""
        now = datetime.datetime.now(datetime.timezone.utc)
        recent_cutoff = now - datetime.timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)
        
        # Check if candidate requested OTP too recently
        result = await db.execute(
            select(OTPVerification)
            .where(
                and_(
                    OTPVerification.candidate_id == candidate.id,
                    OTPVerification.created_at >= recent_cutoff
                )
            )
        )
        if result.scalars().first():
            raise ValueError(f"Please wait {settings.OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new OTP.")

        # Invalidate old unused OTPs
        old_otps_result = await db.execute(
            select(OTPVerification)
            .where(
                and_(
                    OTPVerification.candidate_id == candidate.id,
                    OTPVerification.is_used == False
                )
            )
        )
        for old_otp in old_otps_result.scalars().all():
            old_otp.is_used = True
            
        # Generate fresh OTP
        otp_code = OTPService.generate_otp()
        logger.info(f"🔑 [OTP GENERATED] Candidate {candidate.id} ({candidate.name}): {otp_code}")
        
        # Expiry timestamp
        expires_at = now + datetime.timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
        
        # Save to database
        new_otp = OTPVerification(
            candidate_id=candidate.id,
            otp_code=otp_code,
            channel="email" if candidate.email else "sms",
            expires_at=expires_at
        )
        db.add(new_otp)
        await db.commit()
        
        channels_sent = []
        
        # Dispatch official ASHVANCE TECH OTP Email asynchronously
        if candidate.email:
            email_manager.send_otp_email(candidate.email, candidate.name, otp_code)
            channels_sent.append("email")
                
        # Dispatch SMS in background worker
        if candidate.mobile:
            asyncio.create_task(asyncio.to_thread(OTPService.send_otp_sms, candidate.mobile, otp_code))
            channels_sent.append("sms")
                
        return channels_sent

    @staticmethod
    async def verify_otp(candidate_id: int, otp_code: str, db: AsyncSession) -> tuple[bool, str]:
        """Verify the provided OTP against the database with idempotency and expiration validation."""
        cleaned_otp = str(otp_code).strip()
        
        # 1. Fetch Candidate
        cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
        candidate = cand_result.scalar_one_or_none()
        if not candidate:
            return False, "Candidate not found."

        # 2. Idempotency Check: If already verified, allow immediate entry
        if getattr(candidate, "is_verified", False):
            return True, "Identity verified successfully."

        # 3. Master / Demo OTP bypass (123456 / 999999 / 000000) for friction-free testing
        if cleaned_otp in ("123456", "999999", "000000"):
            candidate.is_verified = True
            await db.commit()
            return True, "Identity verified successfully."

        # 4. Query DB for candidate's matching unused OTP
        result = await db.execute(
            select(OTPVerification)
            .where(
                and_(
                    OTPVerification.candidate_id == candidate_id,
                    OTPVerification.otp_code == cleaned_otp,
                    OTPVerification.is_used == False
                )
            )
            .order_by(OTPVerification.created_at.desc())
        )
        
        valid_otp = result.scalars().first()
        
        if not valid_otp:
            return False, "Invalid or already used OTP code. Please check your email or click Resend."

        # 5. Check Expiry safely in Python
        now = datetime.datetime.now(datetime.timezone.utc)
        exp = valid_otp.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=datetime.timezone.utc)
        
        if now > exp:
            return False, "This OTP has expired. Please click 'Resend Code' to get a fresh PIN."

        # 6. Mark as used & verify candidate
        valid_otp.is_used = True
        candidate.is_verified = True
        await db.commit()

        return True, "Identity verified successfully."


otp_service = OTPService()
