import logging
import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Starting AI Interview Bot backend…")
    await create_tables()

    # Ensure upload directory exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    # Non-blocking AI connectivity test
    asyncio.create_task(health_checker.verify_connectivity())

    logger.info("Database tables created / verified. Server ready.")
    yield
    logger.info("Shutting down AI Interview Bot backend.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-powered interview platform with resume-based question generation.",
    lifespan=lifespan,
)

# ── CORS (must be added before routers) ───────────────────────────────────────
# In production, FRONTEND_URL env var should be set to your Vercel URL
_raw_origins = os.getenv("FRONTEND_URL", "")
_extra_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://frontend-nine-tau-65.vercel.app",   # Production Vercel URL
] + _extra_origins

# Also build a regex to catch any Vercel preview deployments for this project
_vercel_preview_regex = r"https://frontend-nine-tau-65.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=_vercel_preview_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
    max_age=86400,
)

# ── Global error handler ───────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please check backend logs."},
    )

# ── Static file serving ────────────────────────────────────────────────────────
upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(candidates.router)
app.include_router(interviews.router)
app.include_router(reports.router)
app.include_router(admin.router)


# ── Health endpoints ──────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": os.getenv("ENVIRONMENT", "production"),
    }


@app.get("/api/health", tags=["health"])
async def api_health():
    import datetime as _dt
    email_ok = bool(settings.MAIL_USERNAME and "@" in settings.MAIL_USERNAME)
    sms_ok = bool(settings.TWILIO_ACCOUNT_SID and "your" not in settings.TWILIO_ACCOUNT_SID.lower())
    ai_ok = bool(settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"))
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "server": "ok",
        "database": "ok",
        "ai": "ok" if ai_ok else "no_key",
        "email": "ok" if email_ok else "not_configured",
        "sms": "ok" if sms_ok else "not_configured",
        "timestamp": _dt.datetime.utcnow().isoformat(),
    }


@app.get("/api/ai-health", tags=["health"])
async def ai_health_status():
    """Returns the AI provider connectivity status."""
    return health_checker.get_status()


@app.get("/api/email-health", tags=["health"])
async def email_health_status():
    """Returns the internal SMTP connectivity and authentication status."""
    from app.services.email_service import check_smtp_health
    return check_smtp_health()
