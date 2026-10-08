"""
Email Service — ASHVANCE TECH Corporate Email Automation.
Supports official ASHVANCE TECH corporate-branded responsive HTML emails.
Includes strict SMTP provider verification, structured observability, and health checks.
"""

import logging
import smtplib
import asyncio
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional, Dict, Any, Tuple

from app.config import settings

logger = logging.getLogger(__name__)


def _is_email_configured() -> bool:
    """Return True only if real SMTP credentials have been configured."""
    placeholder_keywords = {"your_gmail", "your_16_char", "your_email", "example.com", "yourcompany.com"}
    username = (settings.MAIL_USERNAME or "").lower()
    return bool(username) and not any(k in username for k in placeholder_keywords)


def check_smtp_health() -> Dict[str, str]:
    """
    Perform a safe SMTP health check:
    DNS resolution -> TCP connection -> STARTTLS handshake -> authentication.
    Does NOT send an actual email. Never exposes secrets.
    """
    if not _is_email_configured():
        return {
            "service": "email",
            "smtp_connection": "failed",
            "authentication": "unconfigured",
            "status": "Production email configuration is incomplete."
        }

    try:
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            return {
                "service": "email",
                "smtp_connection": "ok",
                "authentication": "ok",
                "status": "ready"
            }
    except smtplib.SMTPAuthenticationError as exc:
        logger.error(f"[SMTP_HEALTH] Authentication failed: {exc.smtp_code} {exc.smtp_error}")
        return {
            "service": "email",
            "smtp_connection": "ok",
            "authentication": "failed",
            "status": "Authentication rejected by SMTP provider."
        }
    except Exception as exc:
        logger.error(f"[SMTP_HEALTH] SMTP connection failed: {type(exc).__name__}: {exc}")
        return {
            "service": "email",
            "smtp_connection": "failed",
            "authentication": "untested",
            "status": f"Connection error: {type(exc).__name__}"
        }


def _send_email_sync(
    to: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Send an email via SMTP synchronously with comprehensive error diagnostics.
    Returns (success: bool, response_detail: str).
    """
    if not _is_email_configured():
        logger.warning(f"[OTP_EMAIL] SMTP not configured. Missing or placeholder credentials.")
        return False, "Production email configuration is incomplete."

    start_time = time.time()
    domain = to.split("@")[-1] if "@" in to else "unknown"
    logger.info(f"[OTP_EMAIL] send_started=true target_domain={domain} provider=smtp")

    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = f"ASHVANCE TECH <{settings.MAIL_FROM}>"
        msg["To"] = to

        alt_part = MIMEMultipart("alternative")
        if text_body:
            alt_part.attach(MIMEText(text_body, "plain", "utf-8"))
        alt_part.attach(MIMEText(html_body, "html", "utf-8"))
        msg.attach(alt_part)

        if attachment_bytes and attachment_filename:
            pdf_part = MIMEApplication(attachment_bytes, _subtype="pdf")
            pdf_part.add_header("Content-Disposition", "attachment", filename=attachment_filename)
            msg.attach(pdf_part)

        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            refused = server.sendmail(settings.MAIL_FROM, [to], msg.as_string())

        duration = round(time.time() - start_time, 2)
        if refused:
            logger.error(f"[OTP_EMAIL] Recipient refused by provider: {refused} in {duration}s")
            return False, f"Email delivery refused by provider for {domain}"

        logger.info(f"[OTP_EMAIL] provider_response=250 send_completed=true duration={duration}s")
        return True, "250 Message accepted for delivery"

    except smtplib.SMTPAuthenticationError as exc:
        duration = round(time.time() - start_time, 2)
        logger.error(f"[OTP_EMAIL] Authentication error: {exc} duration={duration}s")
        return False, "SMTP authentication failed. Verify provider credentials."
    except smtplib.SMTPServerDisconnected as exc:
        duration = round(time.time() - start_time, 2)
        logger.error(f"[OTP_EMAIL] Connection closed unexpectedly: {exc} duration={duration}s")
        return False, "SMTP connection closed unexpectedly by provider."
    except smtplib.SMTPException as exc:
        duration = round(time.time() - start_time, 2)
        logger.error(f"[OTP_EMAIL] SMTP error: {exc} duration={duration}s")
        return False, f"SMTP provider error: {str(exc)}"
    except Exception as exc:
        duration = round(time.time() - start_time, 2)
        logger.error(f"[OTP_EMAIL] Unexpected email error ({type(exc).__name__}): {exc} duration={duration}s")
        return False, f"Email delivery encountered network failure: {type(exc).__name__}"


class EmailManager:
    """Manages verified automated emails for ASHVANCE TECH Smart Interview AI."""

    def send_otp_email(self, email: str, name: str, otp_code: str) -> Tuple[bool, str]:
        """
        Official Verification PIN Email.
        Complies strictly with Section 10 formatting:
        Subject: ASHVANCE TECH — Interview Verification Code
        """
        subject = "ASHVANCE TECH — Interview Verification Code"
        clean_name = name.strip() if name else "Candidate"

        # Official text version (Section 10 specification)
        text_content = f"""ASHVANCE TECH

Smart Interview AI

Dear {clean_name},

Your verification code for the Smart Interview AI interview platform is:

{otp_code}

This code is valid for 5 minutes.

For security reasons, do not share this verification code with anyone.

Regards,
ASHVANCE TECH
Smart Interview AI

This is an automated email. Please do not reply.
"""

        # Official luxury branded HTML version
        digits_html = "".join(
            f'<div style="display:inline-block;width:44px;height:52px;line-height:52px;'
            f'text-align:center;font-size:26px;font-weight:900;color:#FFFFFF;'
            f'background:linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(14,165,233,0.3) 100%);'
            f'border:2px solid #6366F1;border-radius:10px;margin:0 4px;'
            f'font-family:\'Courier New\',monospace;box-shadow:0 4px 12px rgba(99,102,241,0.25);">{d}</div>'
            for d in otp_code
        )

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ASHVANCE TECH — Interview Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0F1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F8FAFC;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B0F1A;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.6);border:1px solid rgba(99,102,241,0.3);background-color:#0F172A;">
          <tr>
            <td style="background:linear-gradient(135deg, #0A0F1D 0%, #1E1B4B 60%, #4338CA 100%);padding:32px 40px;border-bottom:1px solid rgba(255,255,255,0.1);">
              <h1 style="margin:0;color:#FFFFFF;font-size:22px;font-weight:900;letter-spacing:-0.5px;">ASHVANCE TECH</h1>
              <p style="margin:4px 0 0;color:#38BDF8;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Smart Interview AI</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;background-color:#0F172A;">
              <p style="margin:0 0 16px;color:#E2E8F0;font-size:15px;line-height:1.6;">
                Dear <strong>{clean_name}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#94A3B8;font-size:14px;line-height:1.6;">
                Your verification code for the Smart Interview AI interview platform is:
              </p>
              <div style="background:rgba(10,15,29,0.85);border:1px solid rgba(99,102,241,0.4);border-radius:14px;padding:26px 16px;text-align:center;margin-bottom:26px;">
                <div style="margin-bottom:16px;white-space:nowrap;">
                  {digits_html}
                </div>
                <div style="display:inline-block;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:20px;padding:4px 14px;">
                  <span style="color:#FBBF24;font-size:12px;font-weight:600;">Valid for 5 minutes</span>
                </div>
              </div>
              <p style="margin:0 0 20px;color:#94A3B8;font-size:13px;line-height:1.5;">
                For security reasons, do not share this verification code with anyone.
              </p>
              <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;margin-top:20px;">
                <p style="margin:0 0 4px;color:#E2E8F0;font-size:13px;font-weight:700;">Regards,</p>
                <p style="margin:0 0 2px;color:#6366F1;font-size:13px;font-weight:800;">ASHVANCE TECH</p>
                <p style="margin:0;color:#94A3B8;font-size:12px;">Smart Interview AI</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0A0F1D;padding:20px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:#64748B;font-size:11px;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

        # Execute synchronous SMTP send
        return _send_email_sync(
            to=email,
            subject=subject,
            html_body=html_content,
            text_body=text_content
        )

    def send_completion_email(
        self,
        email: str,
        name: str,
        position: str,
        report: dict,
        pdf_bytes: Optional[bytes] = None
    ) -> Tuple[bool, str]:
        """
        Interview Completed & Assessment Report Email with optional PDF attachment.
        """
        clean_name = name.strip() if name else "Candidate"
        overall_score = report.get("overall_score", 75)
        recommendation = report.get("recommendation", "Under Review")
        subject = f"ASHVANCE TECH — Interview Completed & Assessment Report ({clean_name})"

        text_content = f"""ASHVANCE TECH

Smart Interview AI

Dear {clean_name},

Congratulations on completing your AI technical interview for the {position} role.

Overall Score: {overall_score}/100
Recommendation: {recommendation}

Your comprehensive scorecard has been attached to this email.

Regards,
ASHVANCE TECH
Smart Interview AI

This is an automated email. Please do not reply.
"""

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>{subject}</title></head>
<body style="margin:0;padding:0;background-color:#0B0F1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F8FAFC;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;border-radius:18px;overflow:hidden;background-color:#0F172A;border:1px solid rgba(99,102,241,0.3);">
        <tr><td style="background:linear-gradient(135deg, #0A0F1D, #1E1B4B);padding:32px 40px;">
          <h1 style="margin:0;color:#FFFFFF;font-size:22px;">ASHVANCE TECH</h1>
          <p style="margin:4px 0 0;color:#38BDF8;font-size:12px;font-weight:700;">Smart Interview AI</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 16px;color:#E2E8F0;font-size:15px;">Dear <strong>{clean_name}</strong>,</p>
          <p style="margin:0 0 24px;color:#94A3B8;font-size:14px;line-height:1.6;">
            Thank you for completing your evaluation for the <strong>{position}</strong> role.
          </p>
          <div style="background:rgba(10,15,29,0.85);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <div style="font-size:36px;font-weight:900;color:#10B981;">{overall_score} / 100</div>
            <div style="color:#E2E8F0;font-size:13px;font-weight:700;margin-top:4px;">Verdict: {recommendation}</div>
          </div>
          <p style="color:#94A3B8;font-size:13px;">Your official PDF assessment report is attached.</p>
          <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;margin-top:24px;">
            <p style="margin:0 0 2px;color:#6366F1;font-size:13px;font-weight:800;">ASHVANCE TECH</p>
            <p style="margin:0;color:#94A3B8;font-size:12px;">Smart Interview AI</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

        filename = f"ASHVANCE_TECH_Report_{clean_name.replace(' ', '_')}.pdf" if pdf_bytes else None
        return _send_email_sync(
            to=email,
            subject=subject,
            html_body=html_content,
            text_body=text_content,
            attachment_bytes=pdf_bytes,
            attachment_filename=filename
        )


email_manager = EmailManager()
