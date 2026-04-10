import logging
import os
import asyncio
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

async def transcribe_audio(audio_file_path: str) -> str:
    """Transcribe audio using Google Gemini's multimodal capabilities."""
    try:
        def _do_transcribe():
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
            logger.info(f"Reading audio file for inline Gemini transcription: {audio_file_path}")
            with open(audio_file_path, "rb") as f:
                audio_bytes = f.read()

            model = genai.GenerativeModel(settings.GEMINI_MODEL)
            logger.info("Requesting transcription from Gemini...")
            response = model.generate_content([
                "Transcribe exactly what is spoken in this audio file. Do not add any extra commentary or formatting, just provide the exact transcript. If there is no clear speech, return nothing.",
                {"mime_type": "audio/webm", "data": audio_bytes}
            ])
            return response.text.strip()

        result = await asyncio.to_thread(_do_transcribe)
        return result
        
    except Exception as e:
        import traceback
        with open("transcribe_errors.log", "a") as f:
            f.write(f"\n--- ERROR ---\n{type(e).__name__}: {str(e)}\n{traceback.format_exc()}\n")
        logger.error(f"Transcription error: {e}")
        raise e
