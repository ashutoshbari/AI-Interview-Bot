import logging
import asyncio
import json
from typing import Any, Callable, Dict
from datetime import datetime, timedelta
import httpx

import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)


# ── Compatibility wrappers ─────────────────────────────────────────────────────

class _Message:
    def __init__(self, content: str):
        self.content = content

class _Choice:
    def __init__(self, content_str: str):
        self.message = _Message(content_str)

class _ResponseWrapper:
    """Mimics OpenAI response .choices[0].message.content for drop-in compat."""
    def __init__(self, parsed_json: dict):
        self.choices = [_Choice(json.dumps(parsed_json))]


# ── MockProvider ───────────────────────────────────────────────────────────────

class MockProvider:
    """
    Fully deterministic mock AI provider. Pattern-matching is done against
    known keywords in the *combined* prompt text so it works regardless of
    which field (system/user) the keyword appears in.
    """

    async def generate_json(
        self, system_prompt: str, user_prompt: str, temperature: float = 0.7
    ) -> Dict[str, Any]:
        logger.info("MockProvider: processing request…")
        await asyncio.sleep(0.5)  # Simulate latency

        combined = (system_prompt + " " + user_prompt).lower()

        # ── 1. Resume Summarizer ─────────────────────────────────────────────
        # summarizer.py system: "You are a professional recruiting assistant…"
        # summarizer.py user:   contains "Resume Text:"
        if "recruit" in combined or "resume text:" in combined:
            parsed = {
                "skills": ["Python", "FastAPI", "React", "SQL", "Docker", "Machine Learning"],
                "experience_years": 4,
                "top_projects": ["AI Interview Bot", "Sales Analytics Dashboard"],
                "summary": (
                    "A highly motivated software engineer with expertise in full-stack "
                    "development and AI integration. Passionate about building scalable systems."
                ),
                "seniority": "Mid-level"
            }

        # ── 2. Answer Evaluator ──────────────────────────────────────────────
        # evaluator.py system: "You are a senior technical interviewer…"
        # evaluator.py user:   contains "Candidate Answer:"
        elif "candidate answer:" in combined or "evaluate" in combined:
            parsed = {
                "technical_score": 7.5,
                "clarity_score": 8.0,
                "depth_score": 7.0,
                "communication_score": 8.5,
                "feedback": (
                    "Good answer with clear communication. "
                    "Consider providing more concrete examples to strengthen your response."
                ),
                "is_follow_up_needed": False,
                "suggested_follow_up": None
            }

        # ── 3. Final Report Generator ────────────────────────────────────────
        # report_gen.py system: "…generate a comprehensive report…"
        # report_gen.py user:   contains "overall" or "final report"
        elif "report" in combined or "overall" in combined or "recommendation" in combined:
            parsed = {
                "overall_score": 82,
                "summary": (
                    "A solid candidate who demonstrated good technical knowledge and "
                    "communication skills throughout the interview."
                ),
                "strengths": [
                    "Clear verbal communication",
                    "Good understanding of core concepts",
                    "Structured thinking"
                ],
                "areas_for_improvement": [
                    "Could provide more depth on system design",
                    "Should practice more algorithm questions"
                ],
                "recommendation": "Hire",
                "improvement_suggestions": [
                    "Study distributed systems patterns",
                    "Practice LeetCode medium/hard problems"
                ]
            }

        # ── 4. Question Generator ────────────────────────────────────────────
        # question_gen.py system: "You are a professional technical interviewer…"
        # question_gen.py user:   the DYNAMIC_QUESTION_PROMPT (contains STAGE, CANDIDATE, etc.)
        elif "interviewer" in combined or "stage rules" in combined or "interview history" in combined:
            # Detect stage from the prompt
            if "greeting" in combined or "no history yet" in combined:
                question = (
                    "Welcome! I've reviewed your profile and I'm excited to speak with you today. "
                    "Could you start by giving me a brief introduction of yourself — your background, "
                    "the kind of work you enjoy, and what brought you to this position?"
                )
                q_type = "introduction"
                stage = "greeting"
            elif "experience" in combined:
                question = (
                    "Based on your profile, you have solid hands-on experience. "
                    "Can you walk me through your most recent role — what your day-to-day responsibilities "
                    "were, and what you're most proud of from that period?"
                )
                q_type = "experience"
                stage = "experience"
            elif "project" in combined:
                question = (
                    "I'd like to do a deep dive into one of your projects. "
                    "Can you pick the most technically challenging one and walk me through "
                    "the problem, your approach, and the key decisions you made?"
                )
                q_type = "project"
                stage = "project"
            elif "behavioral" in combined:
                question = (
                    "Tell me about a time when you had to deal with a significant technical obstacle "
                    "under a tight deadline. How did you handle it, and what was the outcome?"
                )
                q_type = "behavioral"
                stage = "behavioral"
            else:
                question = (
                    "Can you explain the architecture of a scalable web application? "
                    "Walk me through how you'd design the backend, handle database load, "
                    "and ensure high availability."
                )
                q_type = "technical"
                stage = "technical"

            parsed = {
                "question": question,
                "type": q_type,
                "stage": stage,
                "is_interview_complete": False
            }

        # ── 5. Fallback ──────────────────────────────────────────────────────
        else:
            logger.warning(f"MockProvider: no pattern matched. system='{system_prompt[:80]}' user='{user_prompt[:80]}'")
            parsed = {
                "question": "Tell me about yourself and your technical background.",
                "type": "introduction",
                "stage": "greeting",
                "is_interview_complete": False
            }

        logger.info(f"MockProvider: returning keys={list(parsed.keys())}")
        return {"data": _ResponseWrapper(parsed), "error": None}


# ── GeminiProvider ─────────────────────────────────────────────────────────────

class GeminiProvider:
    """Gemini AI Provider with Circuit Breaker and auto-reset."""

    def __init__(self):
        self._failure_count = 0
        self._circuit_open = False
        self._circuit_open_until = None
        self._failure_threshold = 5
        self._reset_timeout = 30
        self._lock = asyncio.Lock()
        self._last_error = None
        self._is_config_error = False

    def _make_model(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        return genai.GenerativeModel(model_name=settings.GEMINI_MODEL)

    async def _check_circuit(self) -> bool:
        async with self._lock:
            if self._is_config_error:
                return True
            if self._circuit_open:
                if datetime.now() > self._circuit_open_until:
                    logger.info("Circuit Breaker: Auto-reset — trying again (HALF-OPEN)")
                    self._circuit_open = False
                    self._failure_count = 0
                    return True
                remaining = int((self._circuit_open_until - datetime.now()).total_seconds())
                logger.warning(f"Circuit open. Retry in {remaining}s.")
                return False
            return True

    async def _record_failure(self, error_msg: str, is_config: bool = False):
        async with self._lock:
            self._last_error = error_msg
            self._is_config_error = is_config
            if is_config:
                logger.error(f"AI Config Error: {error_msg}")
                return
            self._failure_count += 1
            logger.error(f"AI Failure #{self._failure_count}: {error_msg}")
            if self._failure_count >= self._failure_threshold:
                self._circuit_open = True
                self._circuit_open_until = datetime.now() + timedelta(seconds=self._reset_timeout)
                logger.critical(f"CIRCUIT BREAKER OPENED — auto-resets at {self._circuit_open_until}")

    async def _record_success(self):
        async with self._lock:
            self._failure_count = 0
            self._circuit_open = False
            self._is_config_error = False
            self._last_error = None

    async def generate_json(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> Dict[str, Any]:
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
            msg = "Gemini API key not configured."
            return {"data": None, "error": msg}

        if not await self._check_circuit():
            remaining = int((self._circuit_open_until - datetime.now()).total_seconds()) if self._circuit_open_until else 30
            return {"data": None, "error": f"AI cooling down. Wait {remaining}s and retry."}

        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        for attempt in range(3):
            try:
                model = self._make_model()
                response = await asyncio.to_thread(
                    model.generate_content,
                    full_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=temperature,
                        response_mime_type="application/json",
                    ),
                )
                text = response.text.strip()
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                    text = text.strip()

                parsed = json.loads(text)
                await self._record_success()
                return {"data": _ResponseWrapper(parsed), "error": None}

            except Exception as e:
                err_str = str(e)
                is_config = any(kw in err_str.lower() for kw in [
                    "api key not valid", "invalid", "permission denied",
                    "api_key_invalid", "unauthenticated"
                ])
                logger.warning(f"Gemini attempt {attempt + 1} failed (config={is_config}): {err_str[:200]}")
                if is_config:
                    await self._record_failure(err_str, is_config=True)
                    return {"data": None, "error": "Gemini API key is invalid. Please update GEMINI_API_KEY in backend/.env"}
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    await self._record_failure(err_str, is_config=False)
                    return {"data": None, "error": f"AI service error after 3 attempts: {err_str[:150]}"}

        return {"data": None, "error": "AI call failed unexpectedly."}


# ── OllamaProvider ─────────────────────────────────────────────────────────────

class OllamaProvider:
    """Ollama AI Provider for local inference."""

    def __init__(self):
        self.url = f"{settings.OLLAMA_URL}/api/generate"
        self.model = settings.OLLAMA_MODEL

    async def generate_json(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> Dict[str, Any]:
        payload = {
            "model": self.model,
            "prompt": f"System: {system_prompt}\n\nUser: {user_prompt}\n\nIMPORTANT: Return ONLY a valid JSON object.",
            "stream": False,
            "format": "json",
            "options": {"temperature": temperature}
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self.url, json=payload, timeout=httpx.Timeout(20.0, connect=5.0))
                response.raise_for_status()
                data = response.json()
                text = data.get("response", "").strip()
                if not text:
                    return {"data": None, "error": "Ollama returned an empty response."}
                parsed = json.loads(text)
                return {"data": _ResponseWrapper(parsed), "error": None}
        except httpx.ConnectError:
            return {"data": None, "error": "Local AI (Ollama) is not running. Run 'ollama run llama3'."}
        except httpx.TimeoutException:
            return {"data": None, "error": "Ollama timed out (20s)."}
        except json.JSONDecodeError as e:
            return {"data": None, "error": "Ollama returned invalid JSON."}
        except Exception as e:
            return {"data": None, "error": f"Local AI Error: {str(e)}"}


# ── Singletons ─────────────────────────────────────────────────────────────────
ai_provider = GeminiProvider()
ollama_provider = OllamaProvider()
mock_provider = MockProvider()


# ── Central dispatcher ─────────────────────────────────────────────────────────

async def openai_safe_call(client_method: Callable, **kwargs) -> Dict[str, Any]:
    """
    Central AI dispatcher. Extracts system/user prompts from messages and
    routes to MockProvider (safe, deterministic, no API keys needed).

    To switch to Gemini: replace `mock_provider` with `ai_provider`.
    To switch to Ollama: replace `mock_provider` with `ollama_provider`.
    """
    messages = kwargs.get("messages", [])
    system_prompt = ""
    user_prompt = ""
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "system":
            system_prompt = content
        elif role == "user":
            user_prompt += content  # accumulate in case of multi-turn

    temperature = kwargs.get("temperature", 0.7)

    result = await mock_provider.generate_json(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
    )

    if result.get("data"):
        try:
            content = result["data"].choices[0].message.content
            logger.debug(f"AI response: {content[:150]}…")
        except Exception:
            pass

    return result
