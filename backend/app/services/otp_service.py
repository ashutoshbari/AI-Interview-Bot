import logging
import secrets
import datetime
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings
from app.models.candidate import Candidate
from app.models.otp_verification import OTPVerification

logger = logging.getLogger(__name__)


def _send_smtp_email_sync(to_email: str, subject: str, html_body: str) -> bool:
    """Synchronous worker for SMTP sending — executed in thread pool."""
    if not settings.MAIL_USERNAME or "your" in settings.MAIL_USERNAME.lower():
        logger.info(f"[DEV] Email not configured. Skipping email to {to_email}: {subject}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"AI Interview Bot <{settings.MAIL_FROM}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.sendmail(settings.MAIL_FROM, [to_email], msg.as_string())

        logger.info(f"✅ Email sent successfully to {to_email}: {subject}")
        return True
    except Exception as exc:
        logger.error(f"❌ Failed to send email to {to_email}: {exc}")
        return False


class OTPService:
    @staticmethod
    def generate_otp() -> str:
        """Generate a secure 6-digit OTP."""
        return f"{secrets.randbelow(1000000):06d}"

    @staticmethod
    async def send_otp_email(email: str, name: str, otp_code: str) -> bool:
        """Send a world-class luxury OTP email asynchronously without blocking the event loop."""
        digits_html = "".join(
            f'<div style="display:inline-block;width:52px;height:62px;line-height:62px;'
            f'text-align:center;font-size:32px;font-weight:900;color:#ffffff;'
            f'background:linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(168,85,247,0.3) 100%);'
            f'border:2px solid #818cf8;border-radius:12px;margin:0 5px;'
            f'box-shadow:0 8px 20px rgba(99,102,241,0.25);font-family:\'Courier New\',monospace;">{d}</div>'
            for d in otp_code
        )

        body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Identity Verification - AI Interview Bot</title>
</head>
<body style="margin:0;padding:0;background-color:#070714;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#070714;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:24px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.7);border:1px solid rgba(99,102,241,0.3);background-color:#0f0f26;">
          
          <!-- HERO HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #8b5cf6 100%);padding:48px 40px;text-align:center;">
              <div style="display:inline-block;width:72px;height:72px;line-height:72px;background:rgba(255,255,255,0.15);border-radius:20px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.3);font-size:36px;margin-bottom:16px;box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                🔐
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">AI Interview Bot</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;font-weight:500;">Secure Candidate Identity Verification</p>
            </td>
          </tr>

          <!-- MAIN CARD BODY -->
          <tr>
            <td style="padding:40px 44px;background-color:#0f0f26;">
              <p style="margin:0 0 6px;color:#a5b4fc;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Hello,</p>
              <h2 style="margin:0 0 20px;color:#ffffff;font-size:24px;font-weight:800;">{name} 👋</h2>
              
              <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.7;">
                You are registered for an interactive <strong style="color:#c084fc;">AI-Powered Technical Interview</strong>. To unlock your personalized session, please enter your 6-digit security code on the verification screen.
              </p>

              <!-- OTP DISPLAY BOX -->
              <div style="background:linear-gradient(180deg, rgba(30,27,75,0.6) 0%, rgba(15,15,38,0.8) 100%);border:2px solid rgba(99,102,241,0.4);border-radius:20px;padding:32px 20px;text-align:center;margin-bottom:32px;box-shadow:inset 0 2px 10px rgba(0,0,0,0.5);">
                <p style="margin:0 0 16px;color:#818cf8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Your 6-Digit One-Time Code</p>
                <div style="margin-bottom:20px;white-space:nowrap;">
                  {digits_html}
                </div>
                <div style="display:inline-block;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:30px;padding:6px 18px;">
                  <span style="color:#fbbf24;font-size:13px;font-weight:600;">⏱️ Valid for next {settings.OTP_EXPIRY_MINUTES} minutes</span>
                </div>
              </div>

              <!-- FEATURE HIGHLIGHTS -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;">
                <tr>
                  <td style="width:48%;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:14px;padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#34d399;font-size:13px;font-weight:700;">✅ Single-Use Security</p>
                    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">This PIN expires immediately after your interview room is unlocked.</p>
                  </td>
                  <td style="width:4%;"></td>
                  <td style="width:48%;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:14px;padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#818cf8;font-size:13px;font-weight:700;">🎙️ AI Voice Enabled</p>
                    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">Microphone enabled interview with real-time speech responses.</p>
                  </td>
                </tr>
              </table>

              <!-- FOOTER NOTE -->
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;border-top:1px solid rgba(255,255,255,0.08);padding-top:24px;">
                If you did not initiate this interview registration, please disregard this email. Your account details remain safe.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#070714;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;color:#475569;font-size:12px;">© 2026 AI Interview Bot Platform • Automated Notification • Do not reply</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
        subject = f"🔐 Your AI Interview Verification Code: {otp_code}"
        return await asyncio.to_thread(_send_smtp_email_sync, email, subject, body)

    @staticmethod
    async def send_interview_started_email(email: str, name: str, position: str) -> bool:
        """Send a luxury 'Interview Started' notification asynchronously."""
        subject = f"🚀 AI Interview Session Live: {position} — {name}"
        body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Live - AI Interview Bot</title>
</head>
<body style="margin:0;padding:0;background-color:#070714;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#070714;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:24px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.7);border:1px solid rgba(16,185,129,0.3);background-color:#0f0f26;">
          
          <!-- HERO HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg, #059669 0%, #10b981 50%, #14b8a6 100%);padding:44px 40px;text-align:center;">
              <div style="font-size:44px;margin-bottom:12px;">🎯</div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;">Interview Session Is Active!</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">Target Role: {position}</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px 44px;background-color:#0f0f26;">
              <h2 style="margin:0 0 10px;color:#ffffff;font-size:22px;font-weight:700;">Best of luck, {name}! 💪</h2>
              <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.7;">
                Your identity has been verified. The AI Interview Bot is conducting your personalized evaluation in real time.
              </p>

              <!-- Role Card -->
              <div style="background:linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(6,95,70,0.15) 100%);border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:24px;margin-bottom:28px;">
                <p style="margin:0 0 4px;color:#6ee7b7;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Assessing Position</p>
                <p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">{position}</p>
              </div>

              <!-- Quick Guidelines -->
              <h3 style="margin:0 0 16px;color:#ffffff;font-size:16px;font-weight:700;">📋 Pro Tips for High Scores:</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <strong style="color:#34d399;">01.</strong>
                    <span style="color:#cbd5e1;font-size:14px;margin-left:8px;">Explain your architecture decisions with concrete project examples.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <strong style="color:#34d399;">02.</strong>
                    <span style="color:#cbd5e1;font-size:14px;margin-left:8px;">Speak clearly into your microphone or provide detailed structured answers.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <strong style="color:#34d399;">03.</strong>
                    <span style="color:#cbd5e1;font-size:14px;margin-left:8px;">Upon interview completion, your scorecard and PDF report are generated instantly.</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#64748b;font-size:12px;border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
                This session is being proctored automatically. Tab switches or copy-pasting are logged.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#070714;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">AI Interview Bot Platform • Automated Dispatch</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
        return await asyncio.to_thread(_send_smtp_email_sync, email, subject, body)

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
                body=f"Your AI Interview verification code is {otp_code}. Valid for {settings.OTP_EXPIRY_MINUTES} mins.",
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
        
        # Dispatch email asynchronously in background task
        if candidate.email:
            asyncio.create_task(OTPService.send_otp_email(candidate.email, candidate.name, otp_code))
            channels_sent.append("email")
                
        # Dispatch SMS in background task
        if candidate.mobile:
            asyncio.create_task(asyncio.to_thread(OTPService.send_otp_sms, candidate.mobile, otp_code))
            channels_sent.append("sms")
                
        return channels_sent

    @staticmethod
    async def verify_otp(candidate_id: int, otp_code: str, db: AsyncSession) -> tuple[bool, str]:
        """Verify the provided OTP against the database with idempotency and robust expiration handling."""
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
            if candidate.email:
                asyncio.create_task(
                    OTPService.send_interview_started_email(
                        candidate.email,
                        candidate.name,
                        candidate.position or "Software Engineer"
                    )
                )
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

        # 7. Dispatch Interview Started confirmation email in background
        if candidate.email:
            asyncio.create_task(
                OTPService.send_interview_started_email(
                    candidate.email,
                    candidate.name,
                    candidate.position or "Software Engineer"
                )
            )

        return True, "Identity verified successfully."


otp_service = OTPService()
