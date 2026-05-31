"""
Resume Summarizer — converts raw resume text into a structured JSON profile
that is stored in candidate.resume_summary and used to personalise interview questions.
"""

import logging
import json
from typing import Dict, Any

from app.config import settings
from app.utils.ai_utils import openai_safe_call
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Client used only as a call-signature carrier; actual calls go through openai_safe_call.
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY or "placeholder")

_SYSTEM_PROMPT = "You are an expert technical recruiter. Return JSON only."

_USER_TEMPLATE = """\
Analyze the following resume text and provide a concise candidate profile summary.
Return ONLY valid JSON with exactly these keys:
{{
  "skills": ["list", "of", "top", "technical", "skills"],
  "experience_years": 3,
  "top_projects": ["Project A", "Project B"],
  "summary": "Two-sentence professional bio.",
  "seniority": "Junior|Mid-level|Senior|Lead"
}}

Resume Text:
{resume_text}
"""

_FALLBACK = {
    "skills": [],
    "experience_years": "Unknown",
    "top_projects": [],
    "summary": "Resume could not be summarised automatically. Raw text will be used.",
    "seniority": "Unknown",
}


async def summarize_resume(resume_text: str) -> Dict[str, Any]:
    """
    Summarise the resume text into a structured JSON profile.
    Always returns a valid dict — never raises.
    """
    if not resume_text or len(resume_text.strip()) < 50:
        logger.warning("[Summarizer] Resume text too short — using fallback profile.")
        return _FALLBACK.copy()

    user_prompt = _USER_TEMPLATE.format(resume_text=resume_text[:4000])
    token_est = len(user_prompt) // 4
    logger.info(f"[Summarizer] Prompt ~{token_est} tokens")

    result = await openai_safe_call(
        client.chat.completions.create,
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=600,
        response_format={"type": "json_object"},
    )

    if result["error"]:
        logger.error(f"[Summarizer] AI error: {result['error']}")
        return _FALLBACK.copy()

    try:
        content = result["data"].choices[0].message.content
        data = json.loads(content)

        # Validate — must have the 'skills' key to be a real summary
        if "skills" not in data:
            raise ValueError(f"Response missing 'skills' key: {list(data.keys())}")

        logger.info(f"[Summarizer] OK — seniority={data.get('seniority')} skills={data.get('skills', [])[:3]}")
        return data

    except Exception as exc:
        logger.error(f"[Summarizer] Parse error: {exc}")
        return _FALLBACK.copy()
