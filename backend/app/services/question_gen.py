"""
Question Generator — dynamically produces the next interview question
based on candidate profile, interview stage, and conversation history.

ROOT CAUSE FIX: The previous stage formula `stages[len(history) // 2]` caused
GREETING to be selected again after the first answer (1//2=0). Replaced with
an explicit stage-progression system that tracks covered stages properly.
"""

import json
import logging
import re
import datetime
from openai import AsyncOpenAI
from app.config import settings
from app.utils.ai_utils import openai_safe_call

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY or "placeholder")


# ── Interview Stage Definitions ──────────────────────────────────────────────
STAGE_PROGRESSION = [
    # (stage_key, display_name, min_answered_to_enter, max_questions_in_stage)
    ("greeting",            "Greeting & Introduction",          0,  1),   # Q1: Introduction
    ("background",          "Background & Journey",             1,  2),   # Q2-Q3: Career context
    ("project_deep_dive",   "Project Deep Dive",                3,  2),   # Q4-Q5: Core projects
    ("technical",           "Technical Architecture & Depth",   5,  2),   # Q6-Q7: In-depth tech
    ("problem_solving",     "Problem Solving & Edge Cases",     7,  2),   # Q8-Q9: Scenarios & scale
    ("behavioral",          "Behavioral & Collaboration",       9,  2),   # Q10-Q11: Leadership & teamwork
    ("candidate_questions", "Candidate Questions & Closing",    11, 1),   # Q12: Candidate queries
]


def _determine_stage(history: list) -> tuple[str, str]:
    """
    Determine the current interview stage based on number of answered questions.
    Returns (stage_key, display_name).
    """
    answered_count = len([h for h in history if h.answer])

    current_stage = STAGE_PROGRESSION[0]
    for stage in STAGE_PROGRESSION:
        if answered_count >= stage[2]:  # min_answered_to_enter
            current_stage = stage
        else:
            break

    return current_stage[0], current_stage[1]


def _get_time_greeting() -> str:
    hour = datetime.datetime.now().hour
    if hour < 12:
        return "Good Morning"
    elif hour < 17:
        return "Good Afternoon"
    else:
        return "Good Evening"


def _tokenize(text: str) -> set:
    """Extract meaningful words from a question for similarity comparison."""
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    stopwords = {
        "the", "and", "for", "you", "your", "can", "how", "what", "tell",
        "about", "did", "was", "were", "have", "that", "with", "this",
        "from", "when", "which", "where", "why", "would", "could", "should",
        "please", "describe", "explain", "walk", "through",
        "interview", "question", "answer", "role", "position", "ashvance", "tech"
    }
    return set(words) - stopwords


def _is_duplicate(new_question: str, history: list, threshold: float = 0.45) -> bool:
    """
    Check if a new question is semantically similar to any prior question.
    Uses Jaccard similarity on keyword tokens.
    """
    if not new_question or not history:
        return False

    new_tokens = _tokenize(new_question)
    if not new_tokens:
        return False

    # Check against ALL past questions to eliminate semantic repeats
    recent_questions = [h.question for h in history if h.question]

    for past_q in recent_questions:
        past_tokens = _tokenize(past_q)
        if not past_tokens:
            continue

        intersection = len(new_tokens & past_tokens)
        union = len(new_tokens | past_tokens)
        if union == 0:
            continue

        similarity = intersection / union
        if similarity >= threshold:
            logger.warning(
                f"[DupDetect] Rejected duplicate (similarity={similarity:.2f}): "
                f"'{new_question[:60]}' ≈ '{past_q[:60]}'"
            )
            return True

    return False


# ── Stage-specific fallback questions ───────────────────────────────────────
_FALLBACK_QUESTIONS = {
    "greeting": {
        "question": (
            f"{_get_time_greeting()}! Welcome to your AI interview at ASHVANCE TECH. "
            "I've reviewed your profile and I'm excited to speak with you today. "
            "Could you start by introducing yourself, your core technical focus, "
            "and what excites you most about this role?"
        ),
        "type": "introduction",
        "stage": "greeting",
    },
    "background": {
        "question": (
            "Can you walk me through your engineering journey — your recent roles, "
            "key architectural responsibilities, and a significant milestone you delivered?"
        ),
        "type": "experience",
        "stage": "background",
    },
    "project_deep_dive": {
        "question": (
            "I'd like to dive deep into a primary project mentioned on your resume. "
            "Walk me through the core problem, your architectural choices, and how you addressed "
            "technical bottlenecks during implementation."
        ),
        "type": "project",
        "stage": "project_deep_dive",
    },
    "technical": {
        "question": (
            "When designing a distributed service that handles high concurrency, "
            "how do you evaluate data consistency, caching strategies, and resilient error recovery?"
        ),
        "type": "technical",
        "stage": "technical",
    },
    "problem_solving": {
        "question": (
            "Suppose a critical production microservice experiences latency spikes under unexpected load. "
            "How do you systematically isolate the root cause and mitigate the bottleneck?"
        ),
        "type": "problem_solving",
        "stage": "problem_solving",
    },
    "behavioral": {
        "question": (
            "Tell me about a time you had a technical disagreement with a teammate or stakeholder. "
            "How did you navigate the conversation, evaluate trade-offs, and reach a constructive outcome?"
        ),
        "type": "behavioral",
        "stage": "behavioral",
    },
    "candidate_questions": {
        "question": (
            "We are nearing the conclusion of our evaluation session. Do you have any questions "
            "regarding the technical direction, culture, or engineering standards at ASHVANCE TECH?"
        ),
        "type": "closing",
        "stage": "candidate_questions",
    },
}


DYNAMIC_QUESTION_PROMPT = """You are an expert Senior Technical Interviewer conducting a real-time interview at ASHVANCE TECH for the Smart Interview AI platform.

CANDIDATE: {name}
POSITION: {position}
CURRENT STAGE: {stage_display} ({stage_key})
PROFILE SUMMARY:
{resume_summary}

RECENT INTERVIEW HISTORY (Last 6 exchanges):
{history}

ALL QUESTIONS ALREADY ASKED (STRICT RULE: NEVER repeat or rephrase any of these):
{asked_questions}

STAGE INSTRUCTIONS:
{stage_instructions}

CRITICAL RULES:
1. Generate EXACTLY ONE contextual question for the current stage.
2. DO NOT ask any question semantically similar to any question in "ALL QUESTIONS ALREADY ASKED".
3. Specifically reference details from the candidate's resume or their previous answers.
4. Adapt difficulty: probe deeper if previous response was vague; explore edge cases if it was strong.
5. Do NOT output metadata, score rubrics, or markdown fences outside the JSON.
6. Keep the phrasing spoken, natural, professional, and clear.
7. If total answered questions >= {max_questions}, set is_interview_complete to true.

Return ONLY a valid JSON object:
{{
  "question": "...",
  "type": "{stage_key}",
  "stage": "{stage_key}",
  "is_interview_complete": false
}}
"""

STAGE_INSTRUCTIONS = {
    "greeting": (
        "This is the initial greeting. Greet {name} warmly ({greeting}) on behalf of ASHVANCE TECH "
        "and invite them to share an overview of their background and passion for {position}."
    ),
    "background": (
        "Ask about candidate's career progression, key engineering environments, or responsibilities owned. "
        "Reference specific timeline points or technologies from their profile."
    ),
    "project_deep_dive": (
        "Select a prominent project from their resume. Ask about system architecture, design trade-offs, "
        "performance optimizations, and challenges they personally resolved."
    ),
    "technical": (
        "Ask targeted technical depth questions specifically on technologies, languages, frameworks, or "
        "system components mentioned in their resume. Adapt complexity to their seniority."
    ),
    "problem_solving": (
        "Present an architectural or engineering scenario involving scale, latency, data integrity, "
        "or fault tolerance related to their domain."
    ),
    "behavioral": (
        "Inquire about teamwork, cross-functional collaboration, ownership, or handling delivery pressure. "
        "Encourage specific situational examples."
    ),
    "candidate_questions": (
        "Invite the candidate to ask any technical or organizational questions regarding ASHVANCE TECH, "
        "engineering practices, or the role."
    ),
}


async def generate_next_question(candidate, history: list) -> dict:
    """
    Generate the next interview question dynamically.

    KEY FIX: Stage is now determined by explicit progression logic, not the
    broken `len(history) // 2` formula that caused greeting to repeat.

    Falls back to a curated stage-appropriate question on any AI failure.
    Max 3 attempts to avoid duplicate questions.
    """
    answered_count = len([h for h in history if h.answer])
    max_questions = getattr(settings, "QUESTIONS_PER_INTERVIEW", 12)

    # Check if interview should end
    if answered_count >= max_questions:
        logger.info(f"[QuestionGen] Interview complete: {answered_count}/{max_questions} questions answered")
        return {"question": None, "type": "closing", "stage": "closing", "is_interview_complete": True}

    # Determine correct stage (THE ROOT CAUSE FIX)
    stage_key, stage_display = _determine_stage(history)
    logger.info(f"[QuestionGen] answered={answered_count} → stage={stage_key}")

    # Check closing stage
    if stage_key == "closing" and answered_count >= 11:
        return {
            **_FALLBACK_QUESTIONS["closing"],
            "is_interview_complete": False,
        }

    # Build profile info
    profile_info = _build_profile_info(candidate)

    # Format recent history (last 6 exchanges)
    answered = [h for h in history if h.answer]
    history_text = _format_history(answered[-6:])

    # Build list of already-asked questions for duplicate prevention
    asked_questions_text = "\n".join(
        f"- {h.question}" for h in history[-10:] if h.question
    ) or "None yet."

    # Stage-specific instructions
    stage_instr = STAGE_INSTRUCTIONS.get(stage_key, STAGE_INSTRUCTIONS["technical"])
    if stage_key == "greeting":
        stage_instr = stage_instr.format(
            greeting=_get_time_greeting(),
            name=candidate.name
        )

    prompt = DYNAMIC_QUESTION_PROMPT.format(
        name=candidate.name,
        position=candidate.position or "Software Engineer",
        stage_display=stage_display,
        stage_key=stage_key,
        resume_summary=profile_info,
        history=history_text,
        asked_questions=asked_questions_text,
        stage_instructions=stage_instr,
        max_questions=max_questions,
    )

    token_est = len(prompt) // 4
    logger.info(f"[QuestionGen] Stage={stage_key} History={answered_count} Prompt~{token_est}tok")

    if token_est > 4500:
        logger.warning(f"[QuestionGen] Prompt too long ({token_est} tok) — using fallback")
        fb = _FALLBACK_QUESTIONS.get(stage_key, _FALLBACK_QUESTIONS["technical"])
        return {**fb, "is_interview_complete": False}

    # Attempt generation with duplicate prevention (max 3 tries)
    for attempt in range(3):
        result = await openai_safe_call(
            client.chat.completions.create,
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a senior technical interviewer. Return JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.75 + (attempt * 0.05),  # Slightly increase temp on retry
            max_tokens=500,
            response_format={"type": "json_object"},
        )

        if result["error"]:
            logger.warning(f"[QuestionGen] AI error (attempt {attempt+1}): {result['error']}")
            break  # Use fallback

        try:
            content = result["data"].choices[0].message.content.strip()
            data = json.loads(content)
            question_text = data.get("question", "").strip()

            if not question_text:
                logger.warning(f"[QuestionGen] Empty question on attempt {attempt+1}")
                continue

            # Duplicate check
            if _is_duplicate(question_text, history):
                logger.info(f"[QuestionGen] Duplicate detected, retrying (attempt {attempt+1})")
                continue

            # Force correct stage key in response
            data["stage"] = stage_key
            data["is_interview_complete"] = data.get("is_interview_complete", False)

            logger.info(f"[QuestionGen] ✅ Generated: stage={stage_key} complete={data.get('is_interview_complete')}")
            return data

        except Exception as e:
            logger.error(f"[QuestionGen] Parse error (attempt {attempt+1}): {e}")
            continue

    # All attempts failed — use fallback
    logger.warning(f"[QuestionGen] Using fallback for stage={stage_key}")
    fb = _FALLBACK_QUESTIONS.get(stage_key, _FALLBACK_QUESTIONS["technical"])
    return {**fb, "is_interview_complete": False}


def _build_profile_info(candidate) -> str:
    """Build a concise profile string from candidate's resume summary or text."""
    profile_info = ""
    try:
        if candidate.resume_summary:
            try:
                summary_obj = json.loads(candidate.resume_summary)
                if "skills" in summary_obj:
                    profile_info = (
                        f"Skills: {', '.join(summary_obj.get('skills', []))}\n"
                        f"Experience: {summary_obj.get('experience_years', 'N/A')} years\n"
                        f"Seniority: {summary_obj.get('seniority', 'N/A')}\n"
                        f"Summary: {summary_obj.get('summary', '')}\n"
                        f"Projects: {', '.join(summary_obj.get('top_projects', []))}"
                    )
                else:
                    profile_info = candidate.resume_summary[:800]
            except (json.JSONDecodeError, TypeError):
                profile_info = str(candidate.resume_summary)[:800]
    except AttributeError:
        pass

    if not profile_info and getattr(candidate, "resume_text", None):
        profile_info = candidate.resume_text[:1200]

    if not profile_info:
        profile_info = f"Candidate applying for {candidate.position or 'Software Engineer'} position."

    return profile_info


def _format_history(answered: list) -> str:
    """Format answered Q&A pairs for the prompt."""
    if not answered:
        return "No previous answers yet. This is the start of the interview."

    parts = []
    for h in answered:
        answer_preview = (h.answer or "[No answer]")[:400]
        parts.append(f"Q: {h.question}\nA: {answer_preview}")
    return "\n\n".join(parts)
