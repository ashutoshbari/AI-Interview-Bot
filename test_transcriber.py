import os
import sys
import asyncio
import traceback

# Add backend to path
sys.path.insert(0, os.path.abspath("backend"))

from backend.app.config import settings
from backend.app.services.transcriber import transcribe_audio

with open("backend/.env") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

async def run():
    print("Testing transcription...")
    with open("dummy.webm", "wb") as f:
        f.write(b"this is a dummy audio file")
    
    try:
        res = await transcribe_audio("dummy.webm")
        print("Success:", res)
    except Exception as e:
        print("Failed:", type(e).__name__, str(e))
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(run())
