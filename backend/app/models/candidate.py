from sqlalchemy import Column, Integer, String, Float, Text, DateTime, func
from app.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    mobile = Column(String(20), nullable=False)
    position = Column(String(255), nullable=True)
    resume_path = Column(String(500), nullable=False)
    resume_text = Column(Text, nullable=True)
    resume_summary = Column(Text, nullable=True)  # Condenced version for optimized prompts
    total_score = Column(Float, nullable=True)
    report_json = Column(Text, nullable=True)  # JSON string of the final report
    status = Column(String(50), default="registered")  # registered | questions_ready | in_progress | completed
    current_stage = Column(String(50), default="greeting")  # greeting | experience | project | technical | behavioral
    last_ai_error = Column(Text, nullable=True)  # For diagnostic tracking
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
