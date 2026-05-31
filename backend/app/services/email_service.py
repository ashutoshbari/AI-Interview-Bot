"""
Email Service — uses Python stdlib smtplib with inline HTML.
No template files or fastapi_mail required.

Emails are sent to:
  • The CANDIDATE (if they provided an email) for status updates.
  • The INTERVIEWER (INTERVIEWER_EMAIL in .env) for every key event:
      – Interview Started
      – Interview Completed
      – Interview Abandoned / Incomplete
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Dict, Any

from app.config import settings

logger = logging.getLogger(__name__)


# ─────────────────────────── helpers ──────────────────────────────────────────

def _is_email_configured() -> bool:
    """Return True only if real SMTP credentials have been set."""
    placeholder_keywords = {"your_gmail", "your_16_char", "your_email", "example.com"}
    username = settings.MAIL_USERNAME.lower()
    return bool(settings.MAIL_USERNAME) and not any(k in username for k in placeholder_keywords)


def _send_email(to: str, subject: str, html_body: str) -> bool:
    """
    Send one HTML email via SMTP.
    Returns True on success, False on failure (never raises).
    """
    if not _is_email_configured():
        logger.info(f"Email skipped (SMTP not configured) — would have sent: {subject!r} → {to}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.MAIL_FROM
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.sendmail(settings.MAIL_FROM, [to], msg.as_string())

        logger.info(f"✅ Email sent: {subject!r} → {to}")
        return True

    except Exception as exc:
        logger.error(f"❌ Email failed ({to}): {exc}")
        return False


# ─────────────────────────── HTML templates (inline) ──────────────────────────

_BASE_STYLE = """
body { margin:0; padding:0; background:#0a0a1a; font-family: 'Segoe UI', Arial, sans-serif; }
.wrap { max-width:600px; margin:40px auto; background:#12122a; border:1px solid rgba(139,92,246,0.3);
        border-radius:16px; overflow:hidden; }
.header { background:linear-gradient(135deg,#4f46e5,#7c3aed); padding:32px 40px; }
.header h1 { color:#fff; margin:0; font-size:22px; letter-spacing:-0.3px; }
.header p { color:rgba(255,255,255,0.7); margin:6px 0 0; font-size:13px; }
.body { padding:32px 40px; }
.body p { color:#c4b5fd; font-size:15px; line-height:1.7; margin:0 0 16px; }
.badge { display:inline-block; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:600; margin-bottom:20px; }
.badge.green { background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3); }
.badge.blue  { background:rgba(99,102,241,0.15);  color:#818cf8; border:1px solid rgba(99,102,241,0.3); }
.badge.red   { background:rgba(239,68,68,0.15);   color:#f87171; border:1px solid rgba(239,68,68,0.3); }
.badge.amber { background:rgba(245,158,11,0.15);  color:#fbbf24; border:1px solid rgba(245,158,11,0.3); }
.divider { border:none; border-top:1px solid rgba(255,255,255,0.07); margin:20px 0; }
.info-row { display:flex; justify-content:space-between; padding:10px 0;
             border-bottom:1px solid rgba(255,255,255,0.05); }
.info-row .label { color:rgba(255,255,255,0.4); font-size:13px; }
.info-row .value { color:#e2e8f0; font-size:13px; font-weight:600; }
.score-box { background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25);
              border-radius:12px; padding:16px 20px; margin:16px 0; text-align:center; }
.score-box .num { font-size:42px; font-weight:800; color:#818cf8; line-height:1; }
.score-box .sub { font-size:13px; color:rgba(255,255,255,0.4); margin-top:4px; }
.footer { background:rgba(0,0,0,0.3); padding:16px 40px; text-align:center;
           color:rgba(255,255,255,0.25); font-size:11px; }
"""


def _html_wrap(header_title: str, header_sub: str, body_inner: str) -> str:
    return f"""<!DOCTYPE html><html><head><style>{_BASE_STYLE}</style></head><body>
<div class="wrap">
  <div class="header">
    <h1>🤖 {header_title}</h1>
    <p>{header_sub}</p>
  </div>
  <div class="body">{body_inner}</div>
  <div class="footer">AI Interview Bot • Automated Notification • Do not reply</div>
</div></body></html>"""


# ─────────────────────────── Email Manager ────────────────────────────────────

class EmailManager:

    # ── Candidate emails ───────────────────────────────────────────────────────

    def send_interview_started(self, email: str, name: str, position: str):
        """Tell the candidate their interview has started."""
        body = f"""
        <span class="badge blue">🎯 Interview Started</span>
        <p>Hi <strong style="color:#e2e8f0">{name}</strong>,</p>
        <p>Your AI-powered interview for the <strong style="color:#e2e8f0">{position}</strong>
           position has officially begun. Answer each question clearly and confidently —
           the AI interviewer will adapt to your responses in real time.</p>
        <p><strong style="color:#a78bfa">Tips for a great interview:</strong></p>
        <ul style="color:#c4b5fd;font-size:14px;line-height:2">
          <li>Speak clearly and concisely</li>
          <li>Give specific examples from your experience</li>
          <li>It's OK to take a moment to think before answering</li>
        </ul>
        <p>Good luck! 🚀</p>"""
        html = _html_wrap("AI Interview Bot", "Your Interview Has Started", body)
        _send_email(email, f"✅ Interview Started — {position}", html)

    def send_interview_completed(self, email: str, name: str, position: str, overall_score: Optional[float] = None):
        """Tell the candidate their interview is done and a report is ready."""
        score_block = ""
        if overall_score is not None:
            color = "#4ade80" if overall_score >= 70 else "#fbbf24" if overall_score >= 50 else "#f87171"
            score_block = f"""
            <div class="score-box">
              <div class="num" style="color:{color}">{overall_score:.0f}</div>
              <div class="sub">Overall Score / 100</div>
            </div>"""

        body = f"""
        <span class="badge green">🎉 Interview Complete</span>
        <p>Hi <strong style="color:#e2e8f0">{name}</strong>,</p>
        <p>You have successfully completed your AI interview for
           <strong style="color:#e2e8f0">{position}</strong>.
           A detailed report with your scores, feedback, and improvement suggestions
           has been generated.</p>
        {score_block}
        <p>The hiring team will review your results and get back to you shortly.
           Thank you for your time!</p>"""
        html = _html_wrap("Interview Complete 🎉", "Thank you for completing your interview", body)
        _send_email(email, f"🎉 Interview Complete — {position}", html)

    def send_interview_incomplete(self, email: str, name: str, position: str):
        """Remind a candidate they left their interview unfinished."""
        body = f"""
        <span class="badge amber">⚠️ Interview Incomplete</span>
        <p>Hi <strong style="color:#e2e8f0">{name}</strong>,</p>
        <p>It looks like your interview for <strong style="color:#e2e8f0">{position}</strong>
           was not fully completed. Your progress has been saved.</p>
        <p>Please return to the interview portal to finish — incomplete interviews
           may not be considered for the position.</p>
        <p style="color:rgba(255,255,255,0.4);font-size:13px">
           If you experienced a technical issue, please contact the HR team.</p>"""
        html = _html_wrap("Interview Reminder", "Your interview is not yet complete", body)
        _send_email(email, f"⚠️ Please Complete Your Interview — {position}", html)

    # ── Interviewer / HR alert emails ──────────────────────────────────────────

    def send_interviewer_alert(
        self,
        event: str,                # "STARTED" | "COMPLETED" | "INCOMPLETE"
        candidate_name: str,
        candidate_email: str,
        position: str,
        extra: Optional[Dict[str, Any]] = None,
    ):
        """
        Send a real-time alert to the INTERVIEWER_EMAIL address configured in .env.
        `extra` can contain keys like 'overall_score', 'recommendation', 'q_count'.
        """
        interviewer_email = settings.INTERVIEWER_EMAIL
        if not interviewer_email or "@" not in interviewer_email:
            logger.debug("No INTERVIEWER_EMAIL configured — skipping HR alert.")
            return
        if "your" in interviewer_email.lower() or "example" in interviewer_email.lower():
            logger.debug("INTERVIEWER_EMAIL is placeholder — skipping HR alert.")
            return

        extra = extra or {}

        if event == "STARTED":
            badge_class, badge_text = "blue", "🎯 Interview Started"
            subject = f"[Alert] {candidate_name} started their interview"
            event_body = f"""
            <p>A candidate has <strong style="color:#818cf8">started</strong> their interview.</p>"""

        elif event == "COMPLETED":
            score = extra.get("overall_score")
            rec = extra.get("recommendation", "—")
            badge_class, badge_text = "green", "✅ Interview Completed"
            subject = f"[Alert] {candidate_name} completed their interview"
            score_block = ""
            if score is not None:
                score_block = f"""<div class="score-box">
                  <div class="num">{score:.0f}</div>
                  <div class="sub">Overall Score / 100</div></div>"""
            event_body = f"""
            <p>A candidate has <strong style="color:#4ade80">completed</strong> their interview.</p>
            {score_block}
            <div class="info-row"><span class="label">Recommendation</span>
            <span class="value" style="color:#4ade80">{rec}</span></div>"""

        elif event == "INCOMPLETE":
            q_count = extra.get("q_count", "?")
            badge_class, badge_text = "amber", "⚠️ Interview Abandoned"
            subject = f"[Alert] {candidate_name} did not finish their interview"
            event_body = f"""
            <p>A candidate <strong style="color:#fbbf24">did not complete</strong> their interview
               (answered {q_count} question(s)).</p>"""

        else:
            badge_class, badge_text = "blue", event
            subject = f"[Alert] Interview event: {event} — {candidate_name}"
            event_body = f"<p>Interview event: {event}</p>"

        body = f"""
        <span class="badge {badge_class}">{badge_text}</span>
        {event_body}
        <hr class="divider">
        <div class="info-row"><span class="label">Candidate</span><span class="value">{candidate_name}</span></div>
        <div class="info-row"><span class="label">Position</span><span class="value">{position}</span></div>
        <div class="info-row"><span class="label">Email</span><span class="value">{candidate_email or 'Not provided'}</span></div>
        <hr class="divider">
        <p style="font-size:13px;color:rgba(255,255,255,0.4)">
          Log into the admin portal to view the full interview transcript and report.</p>"""

        html = _html_wrap("HR / Interviewer Alert", f"Candidate: {candidate_name} • {position}", body)
        _send_email(interviewer_email, subject, html)

    # ── Legacy compatibility shim ─────────────────────────────────────────────
    async def send_status_update(self, email: str, name: str, status: str):
        """Legacy async wrapper kept for backward compatibility."""
        import asyncio
        await asyncio.to_thread(self._send_status_sync, email, name, status)

    def _send_status_sync(self, email: str, name: str, status: str):
        body = f"""
        <p>Hi <strong style="color:#e2e8f0">{name}</strong>,</p>
        <p>Your interview status has been updated to:
           <strong style="color:#818cf8">{status}</strong></p>"""
        html = _html_wrap("Status Update", f"Interview status: {status}", body)
        _send_email(email, f"Interview Status: {status}", html)


# Singleton
email_manager = EmailManager()
