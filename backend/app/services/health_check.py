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
        Performs connectivity tests for both Local (Ollama) and Cloud (Gemini) AI.
        """
        async with self._check_lock:
            logger.info("--- [STARTUP] HYBRID AI CONNECTION TEST ---")
            diagnostics = {
                "timestamp": __import__("datetime").datetime.now().isoformat(),
                "local_ai": {"model": settings.OLLAMA_MODEL, "status": "PENDING"},
                "cloud_ai": {"model": settings.GEMINI_MODEL, "status": "PENDING"}
            }

            # 1. Test Ollama
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{settings.OLLAMA_URL}/api/generate",
                        json={
                            "model": settings.OLLAMA_MODEL,
                            "prompt": "Reply with only the word: OK",
                            "stream": False
                        },
                        timeout=3.0
                    )
                    data = response.json()
                    if data.get("response"):
                        diagnostics["local_ai"]["status"] = "CONNECTED"
                        logger.info(f"Local AI (Ollama) Startup Test: SUCCESS")
            except Exception as e:
                diagnostics["local_ai"]["status"] = f"UNAVAILABLE: {type(e).__name__}"
                logger.warning(f"Local AI (Ollama) Startup Test: UNAVAILABLE")

            # 2. Test Gemini
            try:
                # Use a lightweight check via ai_provider (which uses genai)
                genai.configure(api_key=settings.GEMINI_API_KEY)
                model = genai.GenerativeModel(settings.GEMINI_MODEL)
                response = await asyncio.to_thread(
                    model.generate_content,
                    "OK",
                )
                if response.text:
                    diagnostics["cloud_ai"]["status"] = "CONNECTED"
                    logger.info(f"Cloud AI (Gemini) Startup Test: SUCCESS")
            except Exception as e:
                diagnostics["cloud_ai"]["status"] = f"FAILED: {str(e)[:100]}"
                logger.warning(f"Cloud AI (Gemini) Startup Test: FAILED")

            self.ai_connected = (diagnostics["local_ai"]["status"] == "CONNECTED" or 
                                 diagnostics["cloud_ai"]["status"] == "CONNECTED")
            self.last_error = diagnostics["cloud_ai"]["status"] if not self.ai_connected else None
            self.last_check_time = diagnostics["timestamp"]
            
            return diagnostics

    def get_status(self) -> Dict[str, Any]:
        return {
            "server_status": "running",
            "ai_mode": "Hybrid (Local + Cloud)",
            "ai_connection": "available" if self.ai_connected else "offline",
            "last_check": self.last_check_time
        }


# Singleton health checker
health_checker = AIHealthChecker()
