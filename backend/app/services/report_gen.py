import json
import logging
from openai import AsyncOpenAI
from app.config import settings
from app.utils.ai_utils import openai_safe_call

logger = logging.getLogger(__name__)
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


REPORT_PROMPT = """You are a senior technical interviewer with 15+ years of experience.
Generate a structured final evaluation for the candidate based on the complete interview data provided.

Candidate Name: {name}
Position: {position}

Full Interview Data:
{interview_data}

Rules:
- Be objective, strict, and professional.
- Hiring Recommendation MUST be one of: [Strong Hire, Hire, No Hire].
- Tone: Senior Hiring Manager, Clear, Structured.

Return ONLY valid JSON in this exact format:
{{
  "technical_score": 0-10,
  "problem_solving_score": 0-10,
  "communication_score": 0-10,
  "strengths": ["list", "of", "strings"],
  "weaknesses": ["list", "of", "strings"],
  "improvement_plan": ["list", "of", "strings"],
  "recommendation": "Strong Hire / Hire / No Hire"
}}
"""


async def generate_final_report(
    candidate_name: str,
    position: str,
    interview_records: list[dict]
) -> dict:
    """Generate a structured final report from all interview answers and scores."""

    # Format interview data for the prompt
    interview_data_str = ""
    for rec in interview_records:
        # Use simple dict access if rec is a dict, or getattr if it's a model
        q_order = rec.get('question_order') if isinstance(rec, dict) else getattr(rec, 'question_order', 0)
        q_type = rec.get('question_type', 'general') if isinstance(rec, dict) else getattr(rec, 'question_type', 'general')
        question = rec.get('question', '') if isinstance(rec, dict) else getattr(rec, 'question', '')
        answer = rec.get('answer', 'No answer provided') if isinstance(rec, dict) else getattr(rec, 'answer', 'No answer provided')
        
        tech = rec.get('technical_score', 0) if isinstance(rec, dict) else getattr(rec, 'technical_score', 0)
        clarity = rec.get('clarity_score', 0) if isinstance(rec, dict) else getattr(rec, 'clarity_score', 0)
        depth = rec.get('depth_score', 0) if isinstance(rec, dict) else getattr(rec, 'depth_score', 0)
        comm = rec.get('communication_score', 0) if isinstance(rec, dict) else getattr(rec, 'communication_score', 0)
        feedback = rec.get('feedback', 'N/A') if isinstance(rec, dict) else getattr(rec, 'feedback', 'N/A')

        interview_data_str += f"""
Q{q_order} [{q_type.upper()}]:
Question: {question}
Answer: {answer}
Scores — Technical: {tech}/10 | Clarity: {clarity}/10 | Depth: {depth}/10 | Communication: {comm}/10
Feedback: {feedback}
---"""

    prompt = REPORT_PROMPT.format(
        name=candidate_name,
        position=position or "Software Engineer",
        interview_data=interview_data_str[:7000]
    )

    result_call = await openai_safe_call(
        client.chat.completions.create,
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are a senior hiring manager. Return only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.4,
        max_tokens=1500,
        response_format={ "type": "json_object" }
    )

    if result_call["error"]:
        # Enhanced Fallback
        return {
            "error": result_call["error"],
            "technical_score": 5,
            "problem_solving_score": 5,
            "communication_score": 5,
            "strengths": ["Completed the interview rounds"],
            "weaknesses": ["Detailed AI analysis temporarily unavailable"],
            "improvement_plan": ["Please review manual scores"],
            "recommendation": "Hire (Pending Review)"
        }

    try:
        content = result_call["data"].choices[0].message.content.strip()
        report = json.loads(content)
        return report

    except Exception as e:
        logger.error(f"Report generation parse error: {e}")
        return {
            "technical_score": 0,
            "problem_solving_score": 0,
            "communication_score": 0,
            "strengths": ["N/A"],
            "weaknesses": ["Report parsing failed"],
            "improvement_plan": ["Retry report generation"],
            "recommendation": "No Hire"
        }
