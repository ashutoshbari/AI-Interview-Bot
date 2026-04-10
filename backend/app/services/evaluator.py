import json
import logging
from openai import AsyncOpenAI
from app.config import settings
from app.utils.ai_utils import openai_safe_call

logger = logging.getLogger(__name__)
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


EVALUATION_PROMPT = """You are a senior technical interviewer with 15+ years of experience.
Evaluate the candidate's answer to the question below.

Question: {question}
Candidate Answer: {answer}

Evaluation Criteria:
- Technical Accuracy (0-10)
- Clarity & Communication (0-10)
- Depth of Knowledge (0-10)

Adaptive Intelligence Rules:
- If the answer is SHALLOW or lacks detail: Set `is_follow_up_needed` to true and provide a `suggested_follow_up` to probe for more depth.
- If the answer is STRONG and shows expertise: Set `is_follow_up_needed` to true and provide a `suggested_follow_up` that is significantly MORE CHALLENGING to test their limits.
- If the question is behavioral or project intro: Usually set `is_follow_up_needed` to false unless they were extremely brief.

Return ONLY valid JSON:
{{
  "technical_score": <float>,
  "clarity_score": <float>,
  "depth_score": <float>,
  "communication_score": <float>,
  "feedback": "<Professional 1-sentence feedback>",
  "is_follow_up_needed": <bool>,
  "suggested_follow_up": "<next question or null>"
}}
"""


async def evaluate_answer(question: str, answer: str) -> dict:
    """Evaluate a candidate's answer using OpenAI."""
    if not answer or len(answer.strip()) < 5:
        return {
            "technical_score": 0.0,
            "clarity_score": 0.0,
            "depth_score": 0.0,
            "communication_score": 0.0,
            "feedback": "No meaningful answer was provided.",
            "is_follow_up_needed": False,
            "suggested_follow_up": None
        }

    prompt = EVALUATION_PROMPT.format(question=question, answer=answer[:2000])

    result_call = await openai_safe_call(
        client.chat.completions.create,
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are a senior technical interviewer. Return only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=800,
        response_format={ "type": "json_object" }
    )

    if result_call["error"]:
        # We assign default scores but return the error for UI feedback
        return {
            "error": result_call["error"],
            "technical_score": 5.0,
            "clarity_score": 5.0,
            "depth_score": 5.0,
            "communication_score": 5.0,
            "feedback": f"Evaluation delayed: {result_call['error']}",
            "is_follow_up_needed": False,
            "suggested_follow_up": None
        }

    try:
        content = result_call["data"].choices[0].message.content.strip()
        data = json.loads(content)

        # Validate and clamp scores
        for key in ["technical_score", "clarity_score", "depth_score", "communication_score"]:
            data[key] = max(0.0, min(10.0, float(data.get(key, 5.0))))

        # Ensure follow-up fields exist
        data["is_follow_up_needed"] = bool(data.get("is_follow_up_needed", False))
        data["suggested_follow_up"] = data.get("suggested_follow_up")

        return data

    except Exception as e:
        logger.error(f"Evaluation parse error: {e}")
        return {
            "technical_score": 5.0,
            "clarity_score": 5.0,
            "depth_score": 5.0,
            "communication_score": 5.0,
            "feedback": "Evaluation could not be fully parsed. Default score assigned.",
            "is_follow_up_needed": False,
            "suggested_follow_up": None
        }
