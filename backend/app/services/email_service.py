"""
Email Service — ASHVANCE TECH Corporate Email Automation.
Supports luxury, corporate-branded responsive HTML emails with PDF report attachments.
Thread-safe and asynchronous execution via asyncio.to_thread to prevent event loop blocking.
"""

import logging
import smtplib
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional, Dict, Any, List

from app.config import settings

logger = logging.getLogger(__name__)


def _is_email_configured() -> bool:
    """Return True only if real SMTP credentials have been configured."""
    placeholder_keywords = {"your_gmail", "your_16_char", "your_email", "example.com", "yourcompany.com"}
    username = settings.MAIL_USERNAME.lower()
    return bool(settings.MAIL_USERNAME) and not any(k in username for k in placeholder_keywords)


def _send_email_sync(
    to: str,
    subject: str,
    html_body: str,
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: Optional[str] = None
) -> bool:
    """
    Send one HTML email (with optional PDF attachment) via SMTP synchronously.
    Runs inside worker thread to avoid blocking the asyncio event loop.
    """
    if not _is_email_configured():
        logger.info(f"[DEV] Email skipped (SMTP not configured): {subject!r} -> {to}")
        return False

    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = f"ASHVANCE TECH <{settings.MAIL_FROM}>"
        msg["To"] = to

        # HTML body part
        body_part = MIMEText(html_body, "html")
        msg.attach(body_part)

        # Optional PDF attachment
        if attachment_bytes and attachment_filename:
            pdf_part = MIMEApplication(attachment_bytes, _subtype="pdf")
            pdf_part.add_header("Content-Disposition", "attachment", filename=attachment_filename)
            msg.attach(pdf_part)

        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=12) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.sendmail(settings.MAIL_FROM, [to], msg.as_string())

        logger.info(f"OK: Email sent successfully: {subject!r} -> {to}")
        return True

    except Exception as exc:
        logger.error(f"Email failed ({to}): {exc}")
        return False


def _send_email_async(
    to: str,
    subject: str,
    html_body: str,
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: Optional[str] = None
):
    """Fire-and-forget non-blocking email task."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(asyncio.to_thread(_send_email_sync, to, subject, html_body, attachment_bytes, attachment_filename))
    except RuntimeError:
        asyncio.run(asyncio.to_thread(_send_email_sync, to, subject, html_body, attachment_bytes, attachment_filename))


# ─────────────────────────── ASHVANCE TECH Email Layout ──────────────────────────

def _wrap_ashvance_email(title: str, subtitle: str, body_html: str) -> str:
    """Wraps body in an executive ASHVANCE TECH corporate template."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0F1A;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#F8FAFC;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B0F1A;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.6);border:1px solid rgba(0,136,204,0.3);background-color:#0F172A;">
          
          <!-- CORPORATE BRAND HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg, #0A0F1D 0%, #0F172A 50%, #0088CC 100%);padding:36px 40px;border-bottom:1px solid rgba(255,255,255,0.1);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0;color:#FFFFFF;font-size:22px;font-weight:800;letter-spacing:-0.5px;">ASHVANCE TECH</h1>
                    <p style="margin:4px 0 0;color:#00C2FF;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Smart Interview AI</p>
                  </td>
                  <td align="right">
                    <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:6px 14px;color:#E2E8F0;font-size:11px;font-weight:600;">
                      Official Notification
                    </div>
                  </td>
                </tr>
              </table>
              <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
                <h2 style="margin:0;color:#FFFFFF;font-size:18px;font-weight:700;">{title}</h2>
                <p style="margin:4px 0 0;color:#94A3B8;font-size:13px;">{subtitle}</p>
              </div>
            </td>
          </tr>

          <!-- MAIN CONTENT BODY -->
          <tr>
            <td style="padding:36px 40px;background-color:#0F172A;">
              {body_html}
            </td>
          </tr>

          <!-- CORPORATE FOOTER -->
          <tr>
            <td style="background-color:#0A0F1D;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0 0 4px;color:#FFFFFF;font-size:12px;font-weight:700;">ASHVANCE TECH • Smart Interview AI</p>
              <p style="margin:0 0 10px;color:#64748B;font-size:11px;">Intelligent Hiring. Smarter Interviews.</p>
              <p style="margin:0;color:#475569;font-size:10px;line-height:1.4;">
                © ASHVANCE TECH. All rights reserved.<br/>
                This is an automated system dispatch. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


class EmailManager:
    """Manages the two authorized automated emails for ASHVANCE TECH."""

    def send_otp_email(self, email: str, name: str, otp_code: str):
        """
        EMAIL 1: Official Verification PIN Email.
        Subject: ASHVANCE TECH — Interview Verification Code
        """
        digits_html = "".join(
            f'<div style="display:inline-block;width:48px;height:58px;line-height:58px;'
            f'text-align:center;font-size:28px;font-weight:900;color:#FFFFFF;'
            f'background:linear-gradient(135deg, rgba(0,136,204,0.3) 0%, rgba(124,58,237,0.3) 100%);'
            f'border:2px solid #00C2FF;border-radius:10px;margin:0 4px;'
            f'font-family:\'Courier New\',monospace;box-shadow:0 6px 15px rgba(0,136,204,0.25);">{d}</div>'
            for d in otp_code
        )

        body = f"""
        <p style="margin:0 0 16px;color:#E2E8F0;font-size:15px;line-height:1.6;">
          Dear <strong>{name}</strong>,
        </p>
        <p style="margin:0 0 24px;color:#94A3B8;font-size:14px;line-height:1.6;">
          You have registered for an AI-assisted technical interview on the <strong>ASHVANCE TECH — Smart Interview AI</strong> platform. To verify your identity and unlock your interview studio, please enter the one-time security code below:
        </p>

        <!-- OTP BOX -->
        <div style="background:rgba(10,15,29,0.8);border:1px solid rgba(0,194,255,0.4);border-radius:16px;padding:28px 16px;text-align:center;margin-bottom:28px;">
          <p style="margin:0 0 14px;color:#00C2FF;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Your 6-Digit One-Time Code</p>
          <div style="margin-bottom:18px;white-space:nowrap;">
            {digits_html}
          </div>
          <div style="display:inline-block;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:20px;padding:4px 14px;">
            <span style="color:#FBBF24;font-size:12px;font-weight:600;">⏱️ Valid for next {settings.OTP_EXPIRY_MINUTES} minutes</span>
          </div>
        </div>

        <p style="margin:0 0 12px;color:#94A3B8;font-size:13px;line-height:1.5;">
          <strong>Security Notice:</strong> Do not share this code with anyone. ASHVANCE TECH representatives will never ask for your verification PIN.
        </p>
        <p style="margin:0;color:#64748B;font-size:12px;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
          If you did not initiate this request, please contact recruitment security immediately.
        </p>
        """

        html = _wrap_ashvance_email(
          "Identity Verification",
          "One-Time Security Code for AI Interview Access",
          body
        )
        subject = "ASHVANCE TECH — Interview Verification Code"
        _send_email_async(email, subject, html)

    def send_completion_email(
        self,
        email: str,
        name: str,
        position: str,
        report: dict,
        pdf_bytes: Optional[bytes] = None
    ):
        """
        EMAIL 2: Official Interview Completed & Assessment Report Email.
        Subject: ASHVANCE TECH — Interview Completed & Assessment Report
        Attaches: ASHVANCE_TECH_Interview_Report_<CandidateName>.pdf
        """
        overall_score = report.get("overall_score", 0)
        try:
            score_num = float(overall_score)
        except (ValueError, TypeError):
            score_num = 75.0

        score_color = "#10B981" if score_num >= 75 else "#F59E0B" if score_num >= 50 else "#EF4444"
        verdict = report.get("recommendation") or report.get("verdict") or ("Hire" if score_num >= 65 else "Under Review")

        # Strengths preview
        strengths_list = report.get("strengths") or report.get("top_strengths") or []
        strengths_html = ""
        for s in strengths_list[:3]:
            if isinstance(s, dict):
                title = s.get("title") or s.get("topic") or ""
                detail = s.get("detail") or s.get("description") or ""
                item_text = f"<strong>{title}</strong>: {detail}" if title and detail else (title or detail)
            else:
                item_text = str(s)
            strengths_html += f'<li style="margin-bottom:6px;color:#E2E8F0;font-size:13px;line-height:1.5;">{item_text}</li>'

        if not strengths_html:
            strengths_html = '<li style="color:#E2E8F0;font-size:13px;">Demonstrated strong domain fundamentals and structured problem decomposition.</li>'

        # Growth areas preview
        weaknesses_list = report.get("weaknesses") or report.get("growth_areas") or []
        weaknesses_html = ""
        for w in weaknesses_list[:2]:
            if isinstance(w, dict):
                title = w.get("title") or w.get("topic") or ""
                detail = w.get("detail") or w.get("description") or ""
                item_text = f"<strong>{title}</strong>: {detail}" if title and detail else (title or detail)
            else:
                item_text = str(w)
            weaknesses_html += f'<li style="margin-bottom:6px;color:#E2E8F0;font-size:13px;line-height:1.5;">{item_text}</li>'

        if not weaknesses_html:
            weaknesses_html = '<li style="color:#E2E8F0;font-size:13px;">Continue practicing high-scale architectural trade-offs and concise delivery.</li>'

        clean_candidate_name = name.replace(" ", "_")
        pdf_filename = f"ASHVANCE_TECH_Interview_Report_{clean_candidate_name}.pdf"

        body = f"""
        <p style="margin:0 0 16px;color:#E2E8F0;font-size:15px;line-height:1.6;">
          Dear <strong>{name}</strong>,
        </p>
        <p style="margin:0 0 20px;color:#94A3B8;font-size:14px;line-height:1.6;">
          Thank you for completing your technical interview with <strong>ASHVANCE TECH</strong>.
        </p>
        <p style="margin:0 0 24px;color:#94A3B8;font-size:14px;line-height:1.6;">
          Your AI-assisted evaluation for the <strong>{position}</strong> position has been successfully synthesized and archived. Your official scorecard and comprehensive performance breakdown are summarized below:
        </p>

        <!-- SCORECARD HIGHLIGHT -->
        <div style="background:rgba(10,15,29,0.8);border:1px solid rgba(0,136,204,0.3);border-radius:16px;padding:24px;text-align:center;margin-bottom:28px;">
          <p style="margin:0 0 6px;color:#94A3B8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Overall Performance Score</p>
          <div style="font-size:52px;font-weight:900;color:{score_color};line-height:1;margin-bottom:6px;font-family:'Courier New',monospace;">
            {score_num:.0f}<span style="font-size:22px;color:#64748B;">/100</span>
          </div>
          <div style="display:inline-block;background:{score_color}22;border:1px solid {score_color}66;border-radius:16px;padding:4px 14px;margin-bottom:12px;">
            <span style="color:{score_color};font-size:12px;font-weight:700;">Verdict: {verdict}</span>
          </div>
        </div>

        <!-- KEY STRENGTHS -->
        <div style="margin-bottom:20px;">
          <h3 style="margin:0 0 8px;color:#34D399;font-size:14px;font-weight:700;">✅ Key Demonstrated Strengths:</h3>
          <ul style="margin:0;padding-left:20px;">
            {strengths_html}
          </ul>
        </div>

        <!-- GROWTH AREAS -->
        <div style="margin-bottom:24px;">
          <h3 style="margin:0 0 8px;color:#FBBF24;font-size:14px;font-weight:700;">📈 Growth & Coaching Areas:</h3>
          <ul style="margin:0;padding-left:20px;">
            {weaknesses_html}
          </ul>
        </div>

        <!-- ATTACHMENT NOTICE -->
        <div style="background:rgba(0,136,204,0.1);border:1px solid rgba(0,136,204,0.3);border-radius:12px;padding:14px 18px;margin-bottom:24px;">
          <p style="margin:0;color:#00C2FF;font-size:13px;font-weight:600;">
            📎 Attached: <strong>{pdf_filename}</strong>
          </p>
          <p style="margin:4px 0 0;color:#94A3B8;font-size:12px;">
            A formal, confidential corporate assessment PDF has been attached to this email for your records.
          </p>
        </div>

        <p style="margin:0 0 16px;color:#94A3B8;font-size:13px;line-height:1.6;">
          Our recruitment and engineering panel will review your completed assessment. If your profile matches current openings, an ASHVANCE TECH hiring team member will reach out regarding next steps.
        </p>

        <p style="margin:0;color:#E2E8F0;font-size:13px;line-height:1.6;">
          Sincerely,<br/>
          <strong>ASHVANCE TECH</strong><br/>
          <span style="color:#64748B;font-size:12px;">Smart Interview AI Recruitment Operations</span>
        </p>
        """

        html = _wrap_ashvance_email(
            "Interview Completed & Assessment Report",
            f"Candidate Assessment Results • {position}",
            body
        )
        subject = "ASHVANCE TECH — Interview Completed & Assessment Report"
        _send_email_async(email, subject, html, pdf_bytes, pdf_filename)


email_manager = EmailManager()
