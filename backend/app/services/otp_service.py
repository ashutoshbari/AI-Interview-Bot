import logging
import secrets
import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings
from app.models.candidate import Candidate
from app.models.otp_verification import OTPVerification

logger = logging.getLogger(__name__)


class OTPService:
    @staticmethod
    def generate_otp() -> str:
        """Generate a secure 6-digit OTP."""
        return f"{secrets.randbelow(1000000):06d}"

    @staticmethod
    def send_otp_email(email: str, name: str, otp_code: str) -> bool:
        """Send a beautiful OTP email."""
        if not settings.MAIL_USERNAME or "your" in settings.MAIL_USERNAME.lower():
            logger.info(f"[DEV] Email not configured. OTP for {email} would be: {otp_code}")
            return True

        try:
            subject = f"🔐 Your AI Interview OTP: {otp_code}"

            digits_html = "".join(
                f'<span style="display:inline-block;width:48px;height:56px;line-height:56px;'
                f'text-align:center;font-size:28px;font-weight:900;color:#fff;'
                f'background:rgba(99,102,241,0.25);border:2px solid rgba(99,102,241,0.6);'
                f'border-radius:10px;margin:0 4px;font-family:monospace;">{d}</span>'
                for d in otp_code
            )

            body = f"""
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OTP Verification</title></head>
<body style="margin:0;padding:0;background:#06061a;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#06061a;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- HERO BANNER -->
      <tr><td style="background:linear-gradient(135deg,#4338ca 0%,#7c3aed 50%,#6d28d9 100%);border-radius:20px 20px 0 0;padding:40px 48px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">🤖</div>
        <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">AI Interview Bot</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:15px;">Identity Verification Required</p>
      </td></tr>

      <!-- BODY -->
      <tr><td style="background:#0f0f2e;border:1px solid rgba(99,102,241,0.25);border-top:none;border-radius:0 0 20px 20px;padding:40px 48px;">

        <p style="margin:0 0 6px;color:rgba(255,255,255,0.5);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Hello,</p>
        <h2 style="margin:0 0 20px;color:#fff;font-size:22px;font-weight:700;">{name} 👋</h2>

        <p style="margin:0 0 28px;color:rgba(255,255,255,0.65);font-size:15px;line-height:1.8;">
          You have been registered for an <strong style="color:#a78bfa;">AI-Powered Interview</strong>.
          To verify your identity and unlock your personalised interview session, please enter
          the 6-digit One-Time Password below on the verification screen.
        </p>

        <!-- OTP DIGITS -->
        <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:16px;padding:32px 20px;text-align:center;margin-bottom:28px;">
          <p style="margin:0 0 16px;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:2px;">Your One-Time Password</p>
          <div style="margin-bottom:20px;">{digits_html}</div>
          <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;">⏱️ Expires in <strong style="color:#fbbf24;">{settings.OTP_EXPIRY_MINUTES} minutes</strong></p>
        </div>

        <!-- INFO BOXES -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td style="width:48%;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:12px;padding:16px;">
              <p style="margin:0 0 4px;color:#4ade80;font-size:12px;font-weight:700;">✅ SINGLE USE</p>
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;">This code is valid for one use only.</p>
            </td>
            <td style="width:4%;"></td>
            <td style="width:48%;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:16px;">
              <p style="margin:0 0 4px;color:#f87171;font-size:12px;font-weight:700;">🔒 KEEP SECRET</p>
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;">Never share this code with anyone.</p>
            </td>
          </tr>
        </table>

        <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;border-top:1px solid rgba(255,255,255,0.07);padding-top:24px;">
          If you did not register for an interview, please ignore this email. No action is required.
        </p>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:20px 0;text-align:center;">
        <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;">AI Interview Bot &bull; Automated Notification &bull; Do not reply to this email</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"AI Interview Bot <{settings.MAIL_FROM}>"
            msg["To"] = email
            msg.attach(MIMEText(body, "html"))

            with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                server.sendmail(settings.MAIL_FROM, [email], msg.as_string())

            logger.info(f"OTP Email sent successfully to {email}")
            return True
        except Exception as exc:
            logger.error(f"Failed to send OTP email to {email}: {exc}")
            return False

    @staticmethod
    def send_interview_started_email(email: str, name: str, position: str) -> bool:
        """Send a beautiful 'Interview Started' confirmation email after OTP verification."""
        if not settings.MAIL_USERNAME or "your" in settings.MAIL_USERNAME.lower():
            logger.info(f"[DEV] Email not configured. Skipping interview started email for {email}")
            return True

        try:
            subject = f"🚀 Your AI Interview Has Begun — {position}"

            body = f"""
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Interview Started</title></head>
<body style="margin:0;padding:0;background:#06061a;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#06061a;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- HERO -->
      <tr><td style="background:linear-gradient(135deg,#065f46 0%,#047857 40%,#059669 100%);border-radius:20px 20px 0 0;padding:40px 48px;text-align:center;">
        <div style="font-size:52px;margin-bottom:12px;">🎯</div>
        <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">Interview Is Live!</h1>
        <p style="margin:10px 0 0;color:rgba(255,255,255,0.8);font-size:15px;">Your session has started successfully</p>
      </td></tr>

      <!-- BODY -->
      <tr><td style="background:#0f0f2e;border:1px solid rgba(16,185,129,0.25);border-top:none;border-radius:0 0 20px 20px;padding:40px 48px;">

        <h2 style="margin:0 0 8px;color:#fff;font-size:22px;">Good luck, {name}! 💪</h2>
        <p style="margin:0 0 28px;color:rgba(255,255,255,0.5);font-size:14px;">Your identity has been verified. The AI Interview Bot is ready for you.</p>

        <!-- Role Badge -->
        <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.35);border-radius:12px;padding:20px 24px;margin-bottom:28px;">
          <p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Role you're interviewing for</p>
          <p style="margin:0;color:#34d399;font-size:22px;font-weight:800;">{position}</p>
        </div>

        <!-- Tips -->
        <p style="margin:0 0 16px;color:#fff;font-size:15px;font-weight:700;">📋 Interview Tips:</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="color:#34d399;font-weight:700;">01 &nbsp;</span>
            <span style="color:rgba(255,255,255,0.65);font-size:14px;">Answer clearly and confidently — the AI adapts to your responses in real time.</span>
          </td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="color:#34d399;font-weight:700;">02 &nbsp;</span>
            <span style="color:rgba(255,255,255,0.65);font-size:14px;">Use specific examples from your real experience — avoid generic answers.</span>
          </td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="color:#34d399;font-weight:700;">03 &nbsp;</span>
            <span style="color:rgba(255,255,255,0.65);font-size:14px;">Take a moment to think before answering. Quality beats speed.</span>
          </td></tr>
          <tr><td style="padding:10px 0;">
            <span style="color:#fbbf24;font-weight:700;">⚠️ &nbsp;</span>
            <span style="color:rgba(255,255,255,0.65);font-size:14px;">Do not switch tabs or copy-paste. All activity is being monitored.</span>
          </td></tr>
        </table>

        <p style="margin:32px 0 0;color:rgba(255,255,255,0.3);font-size:12px;border-top:1px solid rgba(255,255,255,0.07);padding-top:24px;">
          This is an automated notification. A detailed report will be emailed to you once you complete all interview rounds.
        </p>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:20px 0;text-align:center;">
        <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;">AI Interview Bot &bull; Automated Notification &bull; Do not reply to this email</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"AI Interview Bot <{settings.MAIL_FROM}>"
            msg["To"] = email
            msg.attach(MIMEText(body, "html"))

            with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                server.sendmail(settings.MAIL_FROM, [email], msg.as_string())

            logger.info(f"Interview Started email sent to {email}")
            return True
        except Exception as exc:
            logger.error(f"Failed to send Interview Started email to {email}: {exc}")
            return False

    @staticmethod
    def send_otp_sms(mobile: str, otp_code: str) -> bool:
        """Send OTP via SMS using Twilio (if configured)."""
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.info(f"[DEV] Twilio not configured. SMS OTP for {mobile} would be: {otp_code}")
            return True
            
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            
            message = client.messages.create(
                body=f"Your AI Interview verification code is {otp_code}. It will expire in {settings.OTP_EXPIRY_MINUTES} minutes.",
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
        """Generate, save, and send an OTP via available channels."""
        # Check cooldown
        now = datetime.datetime.now(datetime.timezone.utc)
        recent_cutoff = now - datetime.timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)
        
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
            old_otp.is_used = True # Mark as used so they can't be used
            
        # Generate new OTP
        otp_code = OTPService.generate_otp()
        logger.info(f"[DEV ALERT] OTP for Candidate {candidate.id} ({candidate.name}): {otp_code}")
        
        # Calculate expiry
        expires_at = now + datetime.timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
        
        # Save to DB
        new_otp = OTPVerification(
            candidate_id=candidate.id,
            otp_code=otp_code,
            channel="email" if candidate.email else "sms",
            expires_at=expires_at
        )
        db.add(new_otp)
        await db.commit()
        
        channels_sent = []
        
        # Send Email
        if candidate.email:
            if OTPService.send_otp_email(candidate.email, candidate.name, otp_code):
                channels_sent.append("email")
                
        # Send SMS
        if candidate.mobile:
            if OTPService.send_otp_sms(candidate.mobile, otp_code):
                channels_sent.append("sms")
                
        return channels_sent

    @staticmethod
    async def verify_otp(candidate_id: int, otp_code: str, db: AsyncSession) -> tuple[bool, str]:
        """Verify the provided OTP against the database."""
        # Fallback master OTP (123456) for email port blocks / portfolio testing
        if otp_code == "123456":
            cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
            candidate = cand_result.scalar_one_or_none()
            if candidate:
                candidate.is_verified = True
                await db.commit()
            return True, "Identity verified successfully."

        now = datetime.datetime.now(datetime.timezone.utc)
        
        result = await db.execute(
            select(OTPVerification)
            .where(
                and_(
                    OTPVerification.candidate_id == candidate_id,
                    OTPVerification.otp_code == otp_code,
                    OTPVerification.is_used == False,
                    OTPVerification.expires_at > now
                )
            )
            .order_by(OTPVerification.created_at.desc())
        )
        
        valid_otp = result.scalars().first()
        
        if valid_otp:
            # Mark as used
            valid_otp.is_used = True
            
            # Update candidate verification status
            cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
            candidate = cand_result.scalar_one_or_none()
            if candidate:
                candidate.is_verified = True
                await db.commit()
                # Send Interview Started email
                if candidate.email:
                    import asyncio
                    asyncio.get_event_loop().run_in_executor(
                        None,
                        OTPService.send_interview_started_email,
                        candidate.email,
                        candidate.name,
                        candidate.position or "Software Engineer"
                    )
            else:
                await db.commit()
            return True, "Identity verified successfully."
        else:
            return False, "Invalid or expired OTP."

otp_service = OTPService()
