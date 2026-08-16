"""
TTS Service — Text-to-Speech using Google gTTS (free, reliable).
Returns MP3 audio bytes for a given text string.
Voice is configured to sound sweet and natural (female).
Used by the /tts endpoint to voice AI interview questions.
"""

import io
import logging
import asyncio
from app.config import settings

logger = logging.getLogger(__name__)


async def synthesize_speech(text: str) -> bytes:
    """
    Convert text to speech audio (MP3 bytes).
    Primary: gTTS (Google Text-to-Speech, free, reliable female voice)
    Fallback: Returns empty bytes if both fail.
    """

    def _gtts_synthesize(text: str) -> bytes:
        """Synchronous gTTS call — runs in thread pool."""
        from gtts import gTTS
        tts = gTTS(
            text=text,
            lang="en",
            tld="co.uk",   # British English — sounds sweeter and more professional
            slow=False,
        )
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        return buf.read()

    # Run synchronous gTTS in a thread pool to avoid blocking the event loop
    try:
        audio_bytes = await asyncio.to_thread(_gtts_synthesize, text)
        logger.info(f"TTS synthesized {len(audio_bytes)} bytes for text: {text[:60]}...")
        return audio_bytes
    except Exception as e:
        logger.error(f"gTTS synthesis failed: {e}", exc_info=True)
        # Try Gemini TTS if gTTS fails
        return await _gemini_tts_fallback(text)


async def _gemini_tts_fallback(text: str) -> bytes:
    """
    Fallback TTS using Google Gemini Live API.
    Uses the 'Aoede' voice preset (sweet, natural female voice).
    """
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)

        def _do_gemini_tts():
            # Gemini TTS via multimodal generation
            # Note: This uses the experimental TTS capability
            model = genai.GenerativeModel("gemini-2.5-flash")
            # Since Gemini doesn't have a direct TTS API in the SDK yet,
            # we use the generate_content with audio output request
            response = model.generate_content(
                f"Please speak this text naturally with a warm, professional female voice: {text}",
                generation_config={"response_modalities": ["AUDIO"]}
            )
            # Extract audio from response if available
            if hasattr(response, 'candidates') and response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data.mime_type.startswith("audio"):
                        return part.inline_data.data
            return None

        result = await asyncio.to_thread(_do_gemini_tts)
        if result:
            logger.info("Gemini TTS fallback succeeded.")
            return result
    except Exception as e:
        logger.error(f"Gemini TTS fallback failed: {e}")

    # Final fallback: return empty bytes (frontend will use Web Speech API)
    logger.warning("All TTS methods failed — returning empty bytes. Frontend will use Web Speech API.")
    return b""
