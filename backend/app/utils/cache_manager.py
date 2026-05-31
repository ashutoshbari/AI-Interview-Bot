import time
import logging
from typing import Any, Optional, Dict
from app.config import settings

logger = logging.getLogger(__name__)

class AICache:
    """
    Simple in-memory cache for AI responses with TTL.
    """
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        if not settings.ENABLE_CACHING:
            return None
        
        entry = self._cache.get(key)
        if not entry:
            return None
        
        # Check TTL
        if time.time() > entry["expiry"]:
            del self._cache[key]
            return None
        
        logger.info(f"Cache Hit: {key[:50]}...")
        return entry["data"]

    def set(self, key: str, data: Any):
        if not settings.ENABLE_CACHING:
            return
        
        self._cache[key] = {
            "data": data,
            "expiry": time.time() + settings.CACHE_TTL
        }
        logger.info(f"Cache Set: {key[:50]}...")

    def clear(self):
        self._cache.clear()

# Global cache instance
ai_cache = AICache()
