import logging
from typing import List, Dict, Any
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.config import settings

logger = logging.getLogger(__name__)

# Verify templates directory exists
import os
template_dir = os.path.join("app", "templates", "emails")
if not os.path.exists(template_dir):
    os.makedirs(template_dir, exist_ok=True)

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=settings.USE_CREDENTIALS,
    VALIDATE_CERTS=settings.VALIDATE_CERTS,
    TEMPLATE_FOLDER=template_dir
)

class EmailManager:
    """
    Handles automated email notifications using fastapi-mail and Jinja2 templates.
    """
    def __init__(self):
        self.fm = FastMail(conf)

    async def send_completion_email(self, email: str, name: str, report: Dict[str, Any]):
        """
        Send detailed interview feedback, score, and suggestions.
        """
        if not email:
            logger.warning(f"Skipping completion email for {name}: No email address.")
            return
        
        template_body = {
            "name": name,
            "overall_score": report.get("overall_score", 0),
            "feedback_summary": report.get("summary", "Thank you for attending the interview."),
            "suggestions": report.get("improvement_suggestions", report.get("suggestions", [])),
            "position": report.get("position", "Software Engineer")
        }

        message = MessageSchema(
            subject="Interview Completed - Your Feedback & Suggestions",
            recipients=[email],
            template_body=template_body,
            subtype=MessageType.html
        )
        
        try:
            await self.fm.send_message(message, template_name="completion.html")
            logger.info(f"Completion email sent successfully to {email}")
        except Exception as e:
            logger.error(f"Failed to send completion email to {email}: {e}")

    async def send_incomplete_reminder(self, email: str, name: str, resume_link: str):
        """
        Send a reminder for an incomplete interview.
        """
        if not email:
            return
        
        template_body = {
            "name": name,
            "resume_link": resume_link
        }

        message = MessageSchema(
            subject="Interview Not Completed - Quick Reminder",
            recipients=[email],
            template_body=template_body,
            subtype=MessageType.html
        )
        
        try:
            await self.fm.send_message(message, template_name="reminder.html")
            logger.info(f"Reminder email sent successfully to {email}")
        except Exception as e:
            logger.error(f"Failed to send reminder email to {email}: {e}")

    async def send_status_update(self, email: str, name: str, status: str):
        """
        Notify candidate of a status update.
        """
        if not email:
            return
        
        template_body = {
            "name": name,
            "status": status.replace("_", " ").title()
        }

        message = MessageSchema(
            subject=f"Interview Status Update: {template_body['status']}",
            recipients=[email],
            template_body=template_body,
            subtype=MessageType.html
        )
        
        try:
            await self.fm.send_message(message, template_name="status_update.html")
            logger.info(f"Status update email sent successfully to {email}")
        except Exception as e:
            logger.error(f"Failed to send status update email to {email}: {e}")

# Singleton instance
email_manager = EmailManager()
