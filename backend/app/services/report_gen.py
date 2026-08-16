import json
import logging
from openai import AsyncOpenAI
from app.config import settings
from app.utils.ai_utils import openai_safe_call

logger = logging.getLogger(__name__)
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


REPORT_PROMPT = """You are a senior technical interviewer and hiring manager with 15+ years of experience at top tech companies.
Generate a structured, comprehensive final evaluation for the candidate based on the complete interview data provided.

Candidate Name: {name}
Position: {position}
Questions Answered: {q_count}

Full Interview Data:
{interview_data}

Rules:
- Be objective, strict, and professional.
- Hiring Recommendation MUST be one of: [Strong Hire, Hire, Needs Improvement, No Hire].
- Reference specific answers in your feedback.
- Overall score is weighted: Technical (35%) + Problem Solving (30%) + Communication (20%) + Depth (15%)
- Tone: Senior Hiring Manager, Clear, Structured, Encouraging.

Return ONLY valid JSON in this exact format:
{{
  "overall_score": 0-100,
  "technical_score": 0-10,
  "problem_solving_score": 0-10,
  "communication_score": 0-10,
  "depth_score": 0-10,
  "strengths": [
    {{"title": "Strength name", "detail": "Specific observation from interview"}}
  ],
  "weaknesses": [
    {{"title": "Area to improve", "detail": "What was lacking and how to fix it"}}
  ],
  "improvement_plan": ["Actionable step 1", "Actionable step 2", "Actionable step 3"],
  "upskilling_plan": [
    {{"topic": "Topic name", "resource": "Specific book/course/article", "priority": "High/Medium/Low"}}
  ],
  "interview_coaching": [
    "Communication tip based on their interview",
    "Structural tip (STAR method etc.)",
    "Pacing or confidence tip"
  ],
  "recommendation": "Strong Hire / Hire / Needs Improvement / No Hire",
  "summary": "2-3 sentence overall summary of the candidate"
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
    answered_count = 0
    all_tech, all_clarity, all_depth, all_comm = [], [], [], []

    for rec in interview_records:
        q_order = rec.get('question_order') if isinstance(rec, dict) else getattr(rec, 'question_order', 0)
        q_type = rec.get('question_type', 'general') if isinstance(rec, dict) else getattr(rec, 'question_type', 'general')
        question = rec.get('question', '') if isinstance(rec, dict) else getattr(rec, 'question', '')
        answer = rec.get('answer', None) if isinstance(rec, dict) else getattr(rec, 'answer', None)

        if not answer:
            continue  # skip unanswered questions

        answered_count += 1
        tech = rec.get('technical_score', 0) if isinstance(rec, dict) else getattr(rec, 'technical_score', 0)
        clarity = rec.get('clarity_score', 0) if isinstance(rec, dict) else getattr(rec, 'clarity_score', 0)
        depth = rec.get('depth_score', 0) if isinstance(rec, dict) else getattr(rec, 'depth_score', 0)
        comm = rec.get('communication_score', 0) if isinstance(rec, dict) else getattr(rec, 'communication_score', 0)
        feedback = rec.get('feedback', 'N/A') if isinstance(rec, dict) else getattr(rec, 'feedback', 'N/A')

        if tech: all_tech.append(float(tech))
        if clarity: all_clarity.append(float(clarity))
        if depth: all_depth.append(float(depth))
        if comm: all_comm.append(float(comm))

        interview_data_str += f"""
Q{q_order} [{(q_type or 'general').upper()}]:
Question: {question}
Answer: {answer[:600]}
Scores — Technical: {tech}/10 | Clarity: {clarity}/10 | Depth: {depth}/10 | Communication: {comm}/10
Feedback: {feedback}
---"""

    # Calculate weighted overall score
    avg_tech = round(sum(all_tech) / len(all_tech), 1) if all_tech else 5.0
    avg_clarity = round(sum(all_clarity) / len(all_clarity), 1) if all_clarity else 5.0
    avg_depth = round(sum(all_depth) / len(all_depth), 1) if all_depth else 5.0
    avg_comm = round(sum(all_comm) / len(all_comm), 1) if all_comm else 5.0
    overall = round((avg_tech * 0.35 + avg_clarity * 0.25 + avg_depth * 0.25 + avg_comm * 0.15) * 10, 1)

    prompt = REPORT_PROMPT.format(
        name=candidate_name,
        position=position or "Software Engineer",
        q_count=answered_count,
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
        max_tokens=2000,
        response_format={"type": "json_object"}
    )

    if result_call["error"]:
        # Enhanced Fallback
        return {
            "error": result_call["error"],
            "overall_score": overall,
            "technical_score": avg_tech,
            "problem_solving_score": avg_depth,
            "communication_score": avg_comm,
            "depth_score": avg_depth,
            "strengths": [{"title": "Completed Interview", "detail": "Candidate completed all interview rounds."}],
            "weaknesses": [{"title": "Analysis Pending", "detail": "Detailed AI analysis temporarily unavailable."}],
            "improvement_plan": ["Review manual scores", "Practice mock interviews", "Study core technical concepts"],
            "upskilling_plan": [{"topic": "Core CS Fundamentals", "resource": "System Design Primer (GitHub)", "priority": "High"}],
            "interview_coaching": ["Structure answers using STAR method", "Be specific with examples", "Speak at a measured pace"],
            "recommendation": "Hire" if overall >= 65 else "Needs Improvement",
            "summary": f"{candidate_name} completed the interview for {position}. Manual review recommended."
        }

    try:
        content = result_call["data"].choices[0].message.content.strip()
        report = json.loads(content)
        # Ensure overall_score is present with our calculated value as fallback
        if "overall_score" not in report:
            report["overall_score"] = overall
        return report

    except Exception as e:
        logger.error(f"Report generation parse error: {e}")
        return {
            "overall_score": overall,
            "technical_score": avg_tech,
            "problem_solving_score": avg_depth,
            "communication_score": avg_comm,
            "depth_score": avg_depth,
            "strengths": [],
            "weaknesses": [{"title": "Parse Error", "detail": "Report parsing failed. Scores are calculated from raw data."}],
            "improvement_plan": ["Retry report generation", "Practice mock interviews"],
            "upskilling_plan": [],
            "interview_coaching": [],
            "recommendation": "Hire" if overall >= 65 else "No Hire",
            "summary": f"Report for {candidate_name} applying for {position}."
        }
