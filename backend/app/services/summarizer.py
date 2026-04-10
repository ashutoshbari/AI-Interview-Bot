import logging
import json
from typing import Dict, Any
from app.config import settings
from app.utils.ai_utils import openai_safe_call
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

async def summarize_resume(resume_text: str) -> Dict[str, Any]:
    """
    Summarizes the resume text into a concise JSON structure to save tokens.
    """
    prompt = f"""
    You are an expert technical recruiter. Analyze the following resume text and provide a concise summary.
    Return ONLY valid JSON with the following keys:
    1. "skills": List of top technical skills.
    2. "experience_years": Total years of relevant experience.
    3. "top_projects": List of 2-3 key projects or achievements.
    4. "summary": A 2-sentence professional bio.
    5. "seniority": One of [Junior, Mid-level, Senior, Lead].

    Resume Text:
    {resume_text[:4000]}  # Limit input to prevent overflow
    """

    prompt_len = len(prompt)
    token_est = prompt_len // 4 
    logger.info(f"AI CALL [Summarize]: Prompt Len: {prompt_len} chars (~{token_est} tokens)")

    result = await openai_safe_call(
        client.chat.completions.create,
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are a professional recruiting assistant. Return JSON only."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=500,
        response_format={ "type": "json_object" }
    )

    if result["error"]:
        logger.error(f"Resume summarization failed: {result['error']}")
        # Fallback to basic extraction if AI fails
        return {
            "skills": ["Not extracted"],
            "experience_years": "Unknown",
            "top_projects": ["Not extracted"],
            "summary": "AI summarization failed temporarily.",
            "seniority": "Unknown",
            "error": result["error"]
        }

    try:
        content = result["data"].choices[0].message.content
        summary_data = json.loads(content)
        return summary_data
    except Exception as e:
        logger.error(f"Failed to parse summarization JSON: {e}")
        return {{
            "skills": ["Parsing error"],
            "experience_years": "Unknown",
            "top_projects": ["Parsing error"],
            "summary": "Resume processing error.",
            "seniority": "Unknown"
        }}
