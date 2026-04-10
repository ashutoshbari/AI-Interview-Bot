import logging
import asyncio
from typing import Dict, Any
import google.generativeai as genai
from app.config import settings
from app.utils.ai_utils import ai_provider

logger = logging.getLogger(__name__)


class AIHealthChecker:
    """
    Manages AI connectivity status and performs startup verification.
    """
    def __init__(self):
        self.ai_connected = False
        self.internet_access = True
        self.last_check_time = None
        self.last_error = None
        self._check_lock = asyncio.Lock()

    async def verify_connectivity(self) -> Dict[str, Any]:
        """
        Performs a lightweight Gemini connectivity test at startup.
        """
        async with self._check_lock:
            logger.info("--- [STARTUP] GEMINI AI CONNECTION TEST ---")
            diagnostics = {
                "timestamp": __import__("datetime").datetime.now().isoformat(),
                "ai_provider": "Google Gemini",
                "model": settings.GEMINI_MODEL,
            }
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                model = genai.GenerativeModel(settings.GEMINI_MODEL)
                response = await asyncio.to_thread(
                    model.generate_content,
                    "Reply with only the word: OK",
                )
                result_text = response.text.strip()
                self.ai_connected = True
                self.last_error = None
                logger.info(f"Gemini Startup Test: SUCCESS — response: {result_text}")
                diagnostics["gemini_api"] = "CONNECTED"
            except Exception as e:
                self.ai_connected = False
                self.last_error = f"[{type(e).__name__}] {str(e)}"
                logger.error(f"Gemini Startup Test FAILED: {self.last_error}")
                diagnostics["gemini_api"] = f"FAILED: {self.last_error}"

            self.last_check_time = diagnostics["timestamp"]
            return diagnostics

    def get_status(self) -> Dict[str, Any]:
        return {
            "server_status": "running",
            "ai_provider": "Google Gemini",
            "ai_connection": "connected" if self.ai_connected else "failed",
            "last_error": self.last_error,
            "last_check": self.last_check_time
        }


# Singleton health checker
health_checker = AIHealthChecker()
