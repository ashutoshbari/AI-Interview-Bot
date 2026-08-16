from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean, func
from app.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    mobile = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    position = Column(String(255), nullable=True)
    resume_path = Column(String(500), nullable=False)
    resume_text = Column(Text, nullable=True)
    resume_summary = Column(Text, nullable=True)  # Condensed version for optimized prompts
    total_score = Column(Float, nullable=True)
    report_json = Column(Text, nullable=True)  # JSON string of the final report
    status = Column(String(50), default="NOT_STARTED")  # NOT_STARTED | IN_PROGRESS | COMPLETED | FAILED
    interview_start_time = Column(DateTime(timezone=True), nullable=True)
    interview_end_time = Column(DateTime(timezone=True), nullable=True)
    current_stage = Column(String(50), default="greeting")  # greeting | experience | project | technical | behavioral
    last_ai_error = Column(Text, nullable=True)  # For diagnostic tracking
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Feature additions ───────────────────────────────────────────────────────
    secure_token = Column(String(64), unique=True, index=True, nullable=True)  # Cryptographic public interview link token
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)  # OTP verified
    tab_switch_count = Column(Integer, default=0, nullable=False)  # Anti-cheat: tab switches
    copy_paste_count = Column(Integer, default=0, nullable=False)  # Anti-cheat: paste attempts
    completion_email_sent = Column(Boolean, default=False, nullable=False)  # Email deduplication
    completion_email_sent_at = Column(DateTime(timezone=True), nullable=True)
