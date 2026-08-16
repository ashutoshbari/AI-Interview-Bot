from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Interview Bot"
    VERSION: str = "1.0.0"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./ai_interview.db"

    # OpenAI (legacy)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Google Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Ollama (Local AI)
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    # File Storage
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    # Interview settings
    QUESTIONS_PER_INTERVIEW: int = 12

    # Frontend URL (for CORS)
    NEXT_PUBLIC_API_URL: str = "http://localhost:3000"

    # ── Email (SMTP) ──────────────────────────────────────────────────────────
    # Interviewer/HR email — receives alerts when candidates start/finish/abandon
    INTERVIEWER_EMAIL: str = ""

    # Candidate email sender settings (Gmail SMTP)
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""          # Use a Gmail App Password (not your real password)
    MAIL_FROM: str = "ai.interview.bot@gmail.com"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True

    # ── OTP Settings ──────────────────────────────────────────────────────────
    OTP_EXPIRY_MINUTES: int = 10
    OTP_RESEND_COOLDOWN_SECONDS: int = 60

    # ── Twilio (optional — SMS OTP) ───────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # ── TTS (Text-to-Speech) ───────────────────────────────────────────────────
    TTS_LANGUAGE: str = "en"
    TTS_TLD: str = "co.uk"       # British English — sweeter, more professional female voice
    TTS_SLOW: bool = False

    # ── WebSocket ──────────────────────────────────────────────────────────────
    WS_HEARTBEAT_INTERVAL: int = 30  # seconds

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def get_settings() -> Settings:
    return Settings()


settings = get_settings()
