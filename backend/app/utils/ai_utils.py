import logging
import asyncio
import json
from typing import Any, Callable, Dict
from datetime import datetime, timedelta

import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)


class GeminiProvider:
    """
    Gemini AI Provider with Circuit Breaker, auto-reset, and config-error detection.
    """

    def __init__(self):
        self._failure_count = 0
        self._circuit_open = False
        self._circuit_open_until = None
        self._failure_threshold = 5          # Trip after 5 real failures (not config errors)
        self._reset_timeout = 30             # Auto-reset after 30 seconds (was 60)
        self._lock = asyncio.Lock()
        self._last_error = None
        self._is_config_error = False        # Track if it's just a bad API key

    def _make_model(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        return genai.GenerativeModel(model_name=settings.GEMINI_MODEL)

    async def _check_circuit(self) -> bool:
        async with self._lock:
            # Config errors (bad API key) never open the circuit — just fail fast each time
            if self._is_config_error:
                return True  # Allow attempt; it will fail with a readable message

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
                # Config errors don't count toward circuit breaker threshold
                logger.error(f"AI Config Error (key/model invalid): {error_msg}")
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
        """
        Call Gemini and return {'data': wrapped_response, 'error': str|None}.
        Drop-in replacement for old openai_safe_call interface.
        """
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
            msg = (
                "Gemini API key not configured. "
                "Please add your free key to backend/.env: GEMINI_API_KEY=your_key_here. "
                "Get one free at https://aistudio.google.com/apikey"
            )
            logger.error(msg)
            return {"data": None, "error": msg}

        if not await self._check_circuit():
            remaining = int((self._circuit_open_until - datetime.now()).total_seconds()) if self._circuit_open_until else 30
            return {
                "data": None,
                "error": f"AI service is cooling down after repeated failures. Please wait {remaining} seconds and retry."
            }

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

                # Strip markdown fences if present
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                    text = text.strip()

                parsed = json.loads(text)
                await self._record_success()
                return {"data": _GeminiResponseWrapper(parsed), "error": None}

            except Exception as e:
                err_str = str(e)

                # Detect config/auth errors — don't count these as infrastructure failures
                is_config = any(kw in err_str.lower() for kw in [
                    "api key not valid", "invalid", "permission denied",
                    "api_key_invalid", "unauthenticated"
                ])

                logger.warning(f"Gemini attempt {attempt + 1} failed (config={is_config}): {err_str[:200]}")

                if is_config:
                    # Don't retry — a bad key won't fix itself
                    await self._record_failure(err_str, is_config=True)
                    return {"data": None, "error": f"Gemini API key is invalid. Please update GEMINI_API_KEY in backend/.env and restart the server."}

                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)  # 1s, 2s
                else:
                    await self._record_failure(err_str, is_config=False)
                    return {"data": None, "error": f"AI service error after 3 attempts: {err_str[:150]}"}

        return {"data": None, "error": "AI call failed unexpectedly."}


# ── Compatibility wrappers ─────────────────────────────────────────────────────

class _GeminiResponseWrapper:
    """Mimics OpenAI response .choices[0].message.content for drop-in compat."""
    def __init__(self, parsed_json: dict):
        self.choices = [_Choice(json.dumps(parsed_json))]


class _Choice:
    def __init__(self, content_str: str):
        self.message = _Message(content_str)


class _Message:
    def __init__(self, content: str):
        self.content = content


# ── Singleton ─────────────────────────────────────────────────────────────────
ai_provider = GeminiProvider()


async def openai_safe_call(client_method: Callable, **kwargs) -> Dict[str, Any]:
    """Drop-in replacement for old openai_safe_call. Routes to Gemini."""
    messages = kwargs.get("messages", [])
    system_prompt = ""
    user_prompt = ""
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "system":
            system_prompt = content
        elif role == "user":
            user_prompt = content

    temperature = kwargs.get("temperature", 0.7)
    return await ai_provider.generate_json(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
    )
