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
# Each stage has: a display name, and a question range (min, max answered before advancing)
STAGE_PROGRESSION = [
    # (stage_key, display_name, min_answered_to_enter, max_questions_in_stage)
    ("greeting",    "Greeting & Introduction",  0,  1),   # 1 question only
    ("background",  "Background & Experience",  1,  2),   # 1-2 questions
    ("project",     "Project Deep Dive",        3,  3),   # 2-3 questions
    ("technical",   "Technical Skills",         6,  3),   # 2-3 questions
    ("behavioral",  "Behavioral & Situational", 9,  2),   # 1-2 questions
    ("closing",     "Closing",                  11, 1),   # 1 question
]


def _determine_stage(history: list) -> tuple[str, str]:
    """
    Determine the current interview stage based on number of answered questions.
    Returns (stage_key, display_name).

    This replaces the broken `stages[len(history) // 2]` formula that caused
    GREETING to repeat when 1 question was answered (1//2 == 0).
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
    # Remove punctuation, lowercase, split
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    # Remove common stop words
    stopwords = {
        "the", "and", "for", "you", "your", "can", "how", "what", "tell",
        "about", "did", "was", "were", "have", "that", "with", "this",
        "from", "when", "which", "where", "why", "would", "could", "should",
        "please", "describe", "explain", "walk", "through", "through",
        "interview", "question", "answer", "role", "position"
    }
    return set(words) - stopwords


def _is_duplicate(new_question: str, history: list, threshold: float = 0.5) -> bool:
    """
    Check if a new question is semantically similar to any recent question.
    Uses Jaccard similarity on keyword tokens.

    Returns True if the question is a duplicate (should be rejected).
    """
    if not new_question or not history:
        return False

    new_tokens = _tokenize(new_question)
    if not new_tokens:
        return False

    # Check against the last 8 questions to catch semantic repeats
    recent_questions = [h.question for h in history[-8:] if h.question]

    for past_q in recent_questions:
        past_tokens = _tokenize(past_q)
        if not past_tokens:
            continue

        # Jaccard similarity: |intersection| / |union|
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
            f"{_get_time_greeting()}! Welcome to your AI-powered interview. "
            "I've reviewed your profile and I'm excited to speak with you today. "
            "Could you start by giving me a brief introduction — your background, "
            "the kind of work you enjoy most, and what brought you to apply for this role?"
        ),
        "type": "introduction",
        "stage": "greeting",
    },
    "background": {
        "question": (
            "Can you walk me through your career journey so far — your most recent role, "
            "the responsibilities you owned, and what you're most proud of from that experience?"
        ),
        "type": "experience",
        "stage": "background",
    },
    "project": {
        "question": (
            "I'd love to do a deep dive into one of your projects. "
            "Pick the most technically challenging one and walk me through the problem, "
            "your architecture decisions, and the key technical choices you made."
        ),
        "type": "project",
        "stage": "project",
    },
    "technical": {
        "question": (
            "Can you explain how you approach designing a system that needs to scale to "
            "millions of users? Walk me through your choice of architecture, storage, "
            "and how you'd handle load distribution."
        ),
        "type": "technical",
        "stage": "technical",
    },
    "behavioral": {
        "question": (
            "Tell me about a time when you faced a significant technical challenge under "
            "a tight deadline. How did you prioritize, collaborate with your team, "
            "and what was the outcome?"
        ),
        "type": "behavioral",
        "stage": "behavioral",
    },
    "closing": {
        "question": (
            "We're wrapping up the interview. Is there anything specific about this role, "
            "the team structure, or the technical challenges you'd like to ask me about?"
        ),
        "type": "closing",
        "stage": "closing",
    },
}


DYNAMIC_QUESTION_PROMPT = """You are an expert Senior Technical Interviewer with 15+ years of experience at top tech companies (Google, Meta, Amazon).

CANDIDATE: {name}
POSITION: {position}
CURRENT STAGE: {stage_display}
PROFILE SUMMARY:
{resume_summary}

RECENT INTERVIEW HISTORY (Last 6 exchanges):
{history}

QUESTIONS ALREADY ASKED (DO NOT repeat or rephrase these):
{asked_questions}

STAGE INSTRUCTIONS:
{stage_instructions}

CRITICAL RULES:
1. Generate EXACTLY ONE question for the current stage.
2. DO NOT ask any question that is semantically similar to the "QUESTIONS ALREADY ASKED" list above.
3. Reference specific details from the PROFILE SUMMARY — do not ask generic questions.
4. If the last answer was shallow, probe deeper on the same topic.
5. If the last answer was strong, increase difficulty or explore a new dimension.
6. Do NOT include meta-talk, scores, greetings (unless in greeting stage), or labels in the question text.
7. Keep questions natural and conversational — as if you are actually speaking to the candidate.
8. After {max_questions} total questions, set is_interview_complete to true.

Return ONLY a valid JSON object:
{{
  "question": "...",
  "type": "introduction|experience|project|technical|behavioral|closing",
  "stage": "{stage_key}",
  "is_interview_complete": false
}}
"""

STAGE_INSTRUCTIONS = {
    "greeting": (
        "This is the FIRST and ONLY greeting. Greet the candidate warmly using '{greeting}', "
        "address them by name ({name}), and ask for a brief introduction of themselves. "
        "This greeting must happen EXACTLY ONCE. After this, NEVER ask for introduction again."
    ),
    "background": (
        "Ask about their career journey, most recent role, responsibilities, or team experience. "
        "Reference specific details from their resume summary if available."
    ),
    "project": (
        "Deep dive into a specific project from their resume. Ask about: architecture, "
        "technology choices, algorithms, implementation challenges, performance optimization, "
        "or deployment. Use the previous answer to decide the follow-up direction."
    ),
    "technical": (
        "Ask technical questions ONLY about technologies specifically mentioned in their resume. "
        "Do not ask about technologies they haven't listed. Adapt difficulty based on their previous answers."
    ),
    "behavioral": (
        "Ask a situational or behavioral question about teamwork, conflict resolution, "
        "deadlines, leadership, or professional growth. Use the STAR format implicitly."
    ),
    "closing": (
        "This is the final question. Invite the candidate to ask any questions they have "
        "about the role, team, or company. Keep it warm and encouraging."
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
