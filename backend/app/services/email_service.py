"""
Email Service — Uses Python stdlib smtplib with luxury, responsive HTML emails.
Thread-safe and asynchronous execution via asyncio.to_thread to prevent event loop blocking.
"""

import logging
import smtplib
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Dict, Any

from app.config import settings

logger = logging.getLogger(__name__)


def _is_email_configured() -> bool:
    """Return True only if real SMTP credentials have been set."""
    placeholder_keywords = {"your_gmail", "your_16_char", "your_email", "example.com", "yourcompany.com"}
    username = settings.MAIL_USERNAME.lower()
    return bool(settings.MAIL_USERNAME) and not any(k in username for k in placeholder_keywords)


def _send_email_sync(to: str, subject: str, html_body: str) -> bool:
    """
    Send one HTML email via SMTP synchronously (executed inside worker threads).
    """
    if not _is_email_configured():
        logger.info(f"Email skipped (SMTP not configured) — would have sent: {subject!r} → {to}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"AI Interview Bot <{settings.MAIL_FROM}>"
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.sendmail(settings.MAIL_FROM, [to], msg.as_string())

        logger.info(f"✅ Email sent successfully: {subject!r} → {to}")
        return True

    except Exception as exc:
        logger.error(f"❌ Email failed ({to}): {exc}")
        return False


def _send_email_async(to: str, subject: str, html_body: str):
    """Fire-and-forget non-blocking email task."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(asyncio.to_thread(_send_email_sync, to, subject, html_body))
    except RuntimeError:
        # If outside loop, execute via background thread
        asyncio.run(asyncio.to_thread(_send_email_sync, to, subject, html_body))


# ─────────────────────────── Luxury Email Base Template ──────────────────────────

def _wrap_luxury_email(header_title: str, header_subtitle: str, gradient_start: str, gradient_end: str, icon: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{header_title}</title>
</head>
<body style="margin:0;padding:0;background-color:#070714;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#070714;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:24px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.7);border:1px solid rgba(99,102,241,0.25);background-color:#0f0f26;">
          
          <!-- HERO HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg, {gradient_start} 0%, {gradient_end} 100%);padding:44px 40px;text-align:center;">
              <div style="display:inline-block;width:64px;height:64px;line-height:64px;background:rgba(255,255,255,0.15);border-radius:18px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.3);font-size:32px;margin-bottom:14px;">
                {icon}
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">{header_title}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;font-weight:500;">{header_subtitle}</p>
            </td>
          </tr>

          <!-- BODY CONTENT -->
          <tr>
            <td style="padding:40px 44px;background-color:#0f0f26;">
              {body_html}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#070714;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:#475569;font-size:12px;line-height:1.5;">
                AI Interview Bot Platform • Automated Intelligent Notification<br>
                Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# ─────────────────────────── Email Manager ────────────────────────────────────

class EmailManager:

    def send_interview_started(self, email: str, name: str, position: str):
        """Notify candidate that their interview is live."""
        body = f"""
        <div style="display:inline-block;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:30px;padding:6px 16px;margin-bottom:20px;">
          <span style="color:#818cf8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🎯 Session Active</span>
        </div>
        <h2 style="margin:0 0 16px;color:#ffffff;font-size:22px;font-weight:700;">Welcome, {name}! 👋</h2>
        <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
          Your AI-powered technical interview for the <strong style="color:#ffffff;">{position}</strong> position is officially in progress.
        </p>

        <div style="background:linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.1) 100%);border:1px solid rgba(99,102,241,0.25);border-radius:16px;padding:20px;margin-bottom:28px;">
          <p style="margin:0 0 6px;color:#c084fc;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Target Position</p>
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">{position}</p>
        </div>

        <h3 style="margin:0 0 14px;color:#ffffff;font-size:15px;font-weight:700;">💡 Key Guidelines:</h3>
        <ul style="margin:0 0 28px;padding-left:20px;color:#cbd5e1;font-size:14px;line-height:1.8;">
          <li>Speak clearly or type structured answers with specific real-world examples.</li>
          <li>The AI interviewer adapts difficulty dynamically based on your responses.</li>
          <li>Upon completion, you will instantly receive your detailed performance scorecard.</li>
        </ul>

        <p style="margin:0;color:#64748b;font-size:12px;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
          Candidate Portal ID: Verified Session
        </p>"""
        
        html = _wrap_luxury_email(
            "AI Interview Bot",
            "Technical Assessment Started",
            "#4338ca",
            "#8b5cf6",
            "🚀",
            body
        )
        _send_email_async(email, f"🎯 Your AI Interview Has Begun — {position}", html)

    def send_interview_completed(self, email: str, name: str, position: str, overall_score: Optional[float] = None, recommendation: Optional[str] = None):
        """Notify candidate of interview completion with scorecard."""
        score_html = ""
        if overall_score is not None:
            color = "#10b981" if overall_score >= 75 else "#f59e0b" if overall_score >= 50 else "#ef4444"
            rec_text = recommendation or ("Strong Hire" if overall_score >= 80 else "Hire" if overall_score >= 60 else "Under Review")
            score_html = f"""
            <div style="background:linear-gradient(180deg, rgba(15,23,42,0.8) 0%, rgba(15,15,38,0.9) 100%);border:2px solid {color}55;border-radius:20px;padding:28px 20px;text-align:center;margin-bottom:28px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Overall Performance Score</p>
              <div style="font-size:56px;font-weight:900;color:{color};line-height:1;margin-bottom:8px;font-family:'Courier New',monospace;">
                {overall_score:.0f}<span style="font-size:24px;color:#64748b;">/100</span>
              </div>
              <div style="display:inline-block;background:{color}22;border:1px solid {color}66;border-radius:20px;padding:6px 16px;">
                <span style="color:{color};font-size:13px;font-weight:700;">Verdict: {rec_text}</span>
              </div>
            </div>"""

        body = f"""
        <div style="display:inline-block;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:30px;padding:6px 16px;margin-bottom:20px;">
          <span style="color:#34d399;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🎉 Completed Successfully</span>
        </div>
        <h2 style="margin:0 0 12px;color:#ffffff;font-size:22px;font-weight:700;">Congratulations, {name}! 🌟</h2>
        <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
          You have completed all stages of the <strong style="color:#ffffff;">{position}</strong> evaluation. The AI has synthesized your responses and generated an in-depth scorecard.
        </p>

        {score_html}

        <p style="margin:0 0 16px;color:#cbd5e1;font-size:14px;line-height:1.7;">
          Your full analytics report with detailed strengths, growth areas, and hiring notes has been archived in the recruiter dashboard.
        </p>

        <p style="margin:0;color:#64748b;font-size:12px;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
          Thank you for interviewing with AI Interview Bot. The recruitment team will reach out with next steps.
        </p>"""

        html = _wrap_luxury_email(
            "Interview Results",
            f"Candidate Performance Summary • {position}",
            "#059669",
            "#10b981",
            "🏆",
            body
        )
        _send_email_async(email, f"🏆 Interview Scorecard & Feedback — {name}", html)

    def send_interviewer_alert(
        self,
        event: str,
        candidate_name: str,
        candidate_email: str,
        position: str,
        extra: Optional[Dict[str, Any]] = None,
    ):
        """Send a real-time HR alert to the INTERVIEWER_EMAIL address."""
        interviewer_email = settings.INTERVIEWER_EMAIL
        if not interviewer_email or "@" not in interviewer_email or "your" in interviewer_email.lower():
            logger.debug("No INTERVIEWER_EMAIL configured — skipping HR alert.")
            return

        extra = extra or {}
        score = extra.get("overall_score")
        rec = extra.get("recommendation", "Evaluation in progress")

        if event == "STARTED":
            header_title = "HR Alert: Interview Started"
            header_sub = f"Candidate: {candidate_name}"
            grad_start, grad_end = "#4338ca", "#6366f1"
            icon = "🔔"
            status_badge = '<span style="color:#818cf8;font-weight:700;">🔵 Interview Commenced</span>'
            subject = f"🔔 [Recruiter Alert] {candidate_name} started interview for {position}"
        elif event == "COMPLETED":
            header_title = "HR Alert: Interview Finished"
            header_sub = f"Score: {score:.0f}/100 • {candidate_name}" if score is not None else candidate_name
            grad_start, grad_end = "#059669", "#10b981"
            icon = "📋"
            status_badge = '<span style="color:#34d399;font-weight:700;">🟢 Completed & Graded</span>'
            subject = f"📋 [Recruiter Alert] {candidate_name} completed interview ({rec})"
        else:
            header_title = f"HR Alert: {event}"
            header_sub = candidate_name
            grad_start, grad_end = "#d97706", "#f59e0b"
            icon = "⚠️"
            status_badge = f'<span style="color:#fbbf24;font-weight:700;">⚠️ {event}</span>'
            subject = f"⚠️ [Recruiter Alert] {candidate_name} - {event}"

        body = f"""
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;margin-bottom:24px;">
          <table width="100%" cellpadding="6" cellspacing="0">
            <tr>
              <td style="color:#94a3b8;font-size:13px;width:35%;">Status:</td>
              <td style="font-size:13px;">{status_badge}</td>
            </tr>
            <tr>
              <td style="color:#94a3b8;font-size:13px;">Candidate:</td>
              <td style="color:#ffffff;font-size:14px;font-weight:700;">{candidate_name}</td>
            </tr>
            <tr>
              <td style="color:#94a3b8;font-size:13px;">Position:</td>
              <td style="color:#c084fc;font-size:14px;font-weight:600;">{position}</td>
            </tr>
            <tr>
              <td style="color:#94a3b8;font-size:13px;">Email:</td>
              <td style="color:#e2e8f0;font-size:13px;">{candidate_email or 'None'}</td>
            </tr>
            {f'<tr><td style="color:#94a3b8;font-size:13px;">Score:</td><td style="color:#34d399;font-size:16px;font-weight:800;">{score:.0f}/100</td></tr>' if score is not None else ''}
            {f'<tr><td style="color:#94a3b8;font-size:13px;">Recommendation:</td><td style="color:#ffffff;font-size:14px;font-weight:700;">{rec}</td></tr>' if rec else ''}
          </table>
        </div>

        <p style="margin:0;color:#64748b;font-size:12px;">
          Access the backend dashboard to view complete audio transcripts, code snippets, and PDF summary.
        </p>"""

        html = _wrap_luxury_email(header_title, header_sub, grad_start, grad_end, icon, body)
        _send_email_async(interviewer_email, subject, html)

    async def send_status_update(self, email: str, name: str, status: str):
        """Asynchronous status notification."""
        body = f"""
        <h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;font-weight:700;">Hello {name},</h2>
        <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
          Your application & interview status has been updated to:
        </p>
        <div style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
          <span style="color:#818cf8;font-size:16px;font-weight:700;">{status}</span>
        </div>"""
        html = _wrap_luxury_email("Application Status Update", f"Candidate: {name}", "#4338ca", "#8b5cf6", "ℹ️", body)
        _send_email_async(email, f"Application Status: {status}", html)


# Singleton instance
email_manager = EmailManager()
