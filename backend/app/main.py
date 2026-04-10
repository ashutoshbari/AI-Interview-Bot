import logging
import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.database import create_tables
from app.routers import candidates, interviews, reports, admin
from app.services.health_check import health_checker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


import sys

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle (Triggered Reload)."""
    logger.info("Starting AI Interview Bot backend with Local AI (Ollama)...")
    await create_tables()
    
    # Ensure upload directory exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    
    # Phase 17.2: Startup Connectivity Test
    asyncio.create_task(health_checker.verify_connectivity())
    
    logger.info("Database tables and startup checks initialized.")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-powered interview platform with resume-based question generation.",
    lifespan=lifespan,
)

from fastapi import Request
from fastapi.responses import JSONResponse

# ... existing code ...

# CORS configuration
# Explicit origins are required when allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Please check backend logs for details."},
    )

# Serve uploaded resumes as static files (optional — for debugging)
upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

# Routers
app.include_router(candidates.router)
app.include_router(interviews.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.VERSION}

@app.get("/api/ai-health", tags=["health"])
async def ai_health_status():
    """Returns the current connectivity status of OpenAI and the local internet."""
    return health_checker.get_status()
 
