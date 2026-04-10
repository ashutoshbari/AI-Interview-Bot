import json
import logging
from openai import AsyncOpenAI
from app.config import settings
from app.utils.ai_utils import openai_safe_call

logger = logging.getLogger(__name__)
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


DYNAMIC_QUESTION_PROMPT = """You are an expert Technical Interviewer with 15+ years of experience.
Conduct a dynamic, professional interview.

CANDIDATE: {name}
POSITION: {position}
CURRENT STAGE: {stage}
PROFILE SUMMARY: {resume_summary}

INTERVIEW HISTORY (Latest 5 interactions):
{history}

STAGE RULES:
1. GREETING: First time only. Greet by name, welcome them, and ask for a brief introduction.
2. EXPERIENCE: Ask about their role, years of exp, or core strengths from their profile.
3. PROJECT: Deep dive into a specific project mentioned in their summary.
4. TECHNICAL: Dynamic technical questions based ONLY on mentioned technologies.
5. BEHAVIORAL: Ask about soft skills or situational challenges.

LOGIC:
- Reference specific details from the PROFILE SUMMARY. No generic questions.
- If the last answer was shallow, probe deeper.
- If the last answer was strong, increase difficulty.
- Ask ONLY ONE question.
- Do NOT include any meta-talk or scores. Just the question.

Return ONLY a valid JSON object:
{{
  "question": "...",
  "type": "...",
  "stage": "...",
  "is_interview_complete": false
}}
"""

async def generate_next_question(candidate, history: list) -> dict:
    """Generate the next question dynamically with strict token optimization."""
    
    # Format and CAP history for the prompt (Latest 5 to save tokens)
    history_text = ""
    for h in history[-5:]:
        history_text += f"Q: {h.question}\nA: {h.answer}\n\n"
    
    if not history_text:
        history_text = "No history yet. This is the start of the interview."

    # Use summary if available, otherwise fallback to truncated text
    profile_info = candidate.resume_summary or (candidate.resume_text[:1500] if candidate.resume_text else "No profile provided.")

    # Determine current stage from history length
    stages = ["GREETING", "EXPERIENCE", "PROJECT", "TECHNICAL", "BEHAVIORAL"]
    stage = stages[min(len(history) // 3, len(stages) - 1)]

    prompt = DYNAMIC_QUESTION_PROMPT.format(
        name=candidate.name,
        position=candidate.position or "Software Engineer",
        stage=stage,
        resume_summary=profile_info,
        history=history_text,
    )

    prompt_len = len(prompt)
    token_est = prompt_len // 4
    logger.info(f"AI CALL [QuestionGen]: Prompt Len: {prompt_len} chars (~{token_est} tokens)")

    if token_est > 3000:
        msg = f"Prompt too long ({token_est} tokens). Please shorten resume or history."
        logger.error(msg)
        return {"error": msg}

    result = await openai_safe_call(
        client.chat.completions.create,
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are a professional technical interviewer. Return JSON only."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=500,
        response_format={ "type": "json_object" }
    )

    if result["error"]:
        return {"error": result["error"]}

    try:
        content = result["data"].choices[0].message.content.strip()
        data = json.loads(content)
        return data
    except Exception as e:
        logger.error(f"Failed to parse AI response: {e}")
        return {"error": "AI service returned an invalid response. Please retry."}
