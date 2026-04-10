from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False, index=True)
    question_order = Column(Integer, nullable=False)
    question_type = Column(String(50), nullable=True)  # technical | project | behavioral | logical
    stage = Column(String(50), nullable=True)  # greeting | experience | project | technical | behavioral
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    technical_score = Column(Float, nullable=True)
    clarity_score = Column(Float, nullable=True)
    depth_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate", backref="interviews")
