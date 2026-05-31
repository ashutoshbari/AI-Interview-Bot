"""
Question Generator — dynamically produces the next interview question
based on candidate profile, interview stage, and conversation history.
"""

import json
import logging
import datetime
from openai import AsyncOpenAI
from app.config import settings
from app.utils.ai_utils import openai_safe_call

logger = logging.getLogger(__name__)

# AsyncOpenAI client is used only as a call signature placeholder;
# actual calls are routed through openai_safe_call → MockProvider/GeminiProvider.
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY or "placeholder")


DYNAMIC_QUESTION_PROMPT = """You are an expert Technical Interviewer with 15+ years of experience.
Conduct a dynamic, professional interview.

CANDIDATE: {name}
POSITION: {position}
CURRENT STAGE: {stage}
PROFILE SUMMARY: {resume_summary}

INTERVIEW HISTORY (Latest 5 interactions):
{history}

STAGE RULES:
1. GREETING: First time only. Greet the candidate with "{time_greeting}" (use this exact time-of-day greeting), address them by name, welcome them warmly, and ask for a brief introduction.
2. EXPERIENCE: Ask about their role, years of experience, or core strengths from their profile.
3. SCENARIO: Provide a "day-in-the-life" situational challenge specifically tailored to a {position}. Describe a realistic workplace problem and ask how they would resolve it.
4. PROJECT: Deep dive into a specific project mentioned in their summary.
5. TECHNICAL: Dynamic technical questions based ONLY on mentioned technologies.
6. BEHAVIORAL: Ask about soft skills or situational challenges.

LOGIC:
- Reference specific details from the PROFILE SUMMARY. Do not ask generic questions.
- If the last answer was shallow, probe deeper on the same topic.
- If the last answer was strong, increase difficulty.
- Ask ONLY ONE question at a time.
- Do NOT include any meta-talk, scores, or labels. Just the question.
- After 12–15 questions total, set is_interview_complete to true.

Return ONLY a valid JSON object:
{{
  "question": "...",
  "type": "introduction|experience|scenario|project|technical|behavioral",
  "stage": "greeting|experience|scenario|project|technical|behavioral",
  "is_interview_complete": false
}}
"""

# Stage-aware fallback questions (used when AI is unavailable)
def _get_time_greeting() -> str:
    hour = datetime.datetime.now().hour
    if hour < 12:
        return "Good Morning"
    elif hour < 17:
        return "Good Afternoon"
    else:
        return "Good Evening"

_FALLBACK_QUESTIONS = {
    "GREETING": {
        "question": (
            f"{_get_time_greeting()}! Welcome to your AI-powered interview. "
            "I've reviewed your profile and I'm excited to speak with you today. "
            "Could you start by giving me a brief introduction — your background, the kind of "
            "work you enjoy most, and what brought you to apply for this role?"
        ),
        "type": "introduction",
        "stage": "greeting",
    },
    "EXPERIENCE": {
        "question": (
            "Can you walk me through your most recent role — what your day-to-day responsibilities were, "
            "your team setup, and what you're most proud of from that time?"
        ),
        "type": "experience",
        "stage": "experience",
    },
    "SCENARIO": {
        "question": (
            "Imagine you've just been assigned an urgent task that requires a technology you've never used before, "
            "and the deadline is tomorrow. Walk me through exactly how you would approach this situation."
        ),
        "type": "scenario",
        "stage": "scenario",
    },
    "PROJECT": {
        "question": (
            "I'd love to do a deep dive into one of your projects. "
            "Pick the most technically challenging one and walk me through the problem, "
            "your approach, and the key architectural or design decisions you made."
        ),
        "type": "project",
        "stage": "project",
    },
    "TECHNICAL": {
        "question": (
            "Can you explain how you would design a scalable REST API service? "
            "Walk me through your choice of architecture, data storage, authentication, and "
            "how you'd handle high traffic loads."
        ),
        "type": "technical",
        "stage": "technical",
    },
    "BEHAVIORAL": {
        "question": (
            "Tell me about a time when you had to deal with a significant technical obstacle "
            "under a tight deadline. How did you prioritize, and what was the outcome?"
        ),
        "type": "behavioral",
        "stage": "behavioral",
    },
}


async def generate_next_question(candidate, history: list) -> dict:
    """
    Generate the next interview question dynamically.
    Falls back to a curated stage-appropriate question on any AI failure.
    """

    # Determine current stage
    stages = ["GREETING", "EXPERIENCE", "SCENARIO", "PROJECT", "TECHNICAL", "BEHAVIORAL"]
    stage = stages[min(len(history) // 2, len(stages) - 1)]

    # Check if interview should end
    if len(history) >= 15:
        return {"question": None, "type": "closing", "stage": "closing", "is_interview_complete": True}

    # Format history (latest 5 answered exchanges)
    answered = [h for h in history if h.answer]
    history_text = ""
    for h in answered[-5:]:
        history_text += f"Q: {h.question}\nA: {h.answer or '[No answer]'}\n\n"
    if not history_text:
        history_text = "No history yet. This is the start of the interview."

    # Build profile info from summary (or truncated resume text)
    profile_info = ""
    try:
        if candidate.resume_summary:
            # Parse if it's JSON; fallback to using as-is
            try:
                summary_obj = json.loads(candidate.resume_summary)
                # Only use if it's actually a summary (has 'skills' key), not a question object
                if "skills" in summary_obj:
                    profile_info = (
                        f"Skills: {', '.join(summary_obj.get('skills', []))}\n"
                        f"Experience: {summary_obj.get('experience_years', 'N/A')} years\n"
                        f"Seniority: {summary_obj.get('seniority', 'N/A')}\n"
                        f"Summary: {summary_obj.get('summary', '')}\n"
                        f"Projects: {', '.join(summary_obj.get('top_projects', []))}"
                    )
                else:
                    # Malformed summary — use raw text
                    profile_info = candidate.resume_summary[:800]
            except json.JSONDecodeError:
                profile_info = candidate.resume_summary[:800]
    except AttributeError:
        pass

    if not profile_info and getattr(candidate, "resume_text", None):
        profile_info = candidate.resume_text[:1200]

    if not profile_info:
        profile_info = f"Candidate applying for {candidate.position or 'Software Engineer'} position."

    prompt = DYNAMIC_QUESTION_PROMPT.format(
        name=candidate.name,
        position=candidate.position or "Software Engineer",
        stage=stage,
        resume_summary=profile_info,
        history=history_text,
        time_greeting=_get_time_greeting(),
    )

    token_est = len(prompt) // 4
    logger.info(f"[QuestionGen] Stage={stage} History={len(answered)} Prompt~{token_est}tok")

    # Safety guard — should never be exceeded with the above caps
    if token_est > 4000:
        logger.warning(f"[QuestionGen] Prompt too long ({token_est} tok) — using fallback")
        fb = _FALLBACK_QUESTIONS.get(stage, _FALLBACK_QUESTIONS["TECHNICAL"])
        return {**fb, "is_interview_complete": False}

    # Call the AI
    result = await openai_safe_call(
        client.chat.completions.create,
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are a professional technical interviewer. Return JSON only."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=500,
        response_format={"type": "json_object"},
    )

    if result["error"]:
        logger.warning(f"[QuestionGen] AI error: {result['error']} — using fallback")
        fb = _FALLBACK_QUESTIONS.get(stage, _FALLBACK_QUESTIONS["TECHNICAL"])
        return {**fb, "is_interview_complete": False}

    try:
        content = result["data"].choices[0].message.content.strip()
        data = json.loads(content)

        # Validate — must have a non-empty question
        if not data.get("question"):
            raise ValueError("question field is empty")

        logger.info(f"[QuestionGen] Generated: stage={data.get('stage')} complete={data.get('is_interview_complete')}")
        return data

    except Exception as e:
        logger.error(f"[QuestionGen] Parse error: {e} — using fallback")
        fb = _FALLBACK_QUESTIONS.get(stage, _FALLBACK_QUESTIONS["TECHNICAL"])
        return {**fb, "is_interview_complete": False}
