import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
_ENV_FILE_PATH = os.path.join(_BACKEND_DIR, ".env")
_DEFAULT_SQLITE_PATH = os.path.join(_BACKEND_DIR, "axora.db").replace("\\", "/")

class Settings(BaseSettings):
    APP_NAME: str = "CampVion"
    APP_VERSION: str = "0.2.0"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = f"sqlite:///{_DEFAULT_SQLITE_PATH}"
    API_PREFIX: str = "/api"

    # Cloud-First LLM Architecture (Groq as Primary)
    LLM_PROVIDER: str = "groq"  # "groq" (primary), "gemini", "openai", "mock", "ollama"
    LLM_MODEL: str = "qwen/qwen3.8-27b"
    LLM_API_KEY: Optional[str] = None

    # Groq Provider Settings
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "qwen/qwen3.8-27b"

    # Alternative Provider Credentials
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Connection & Cost Guardrails
    LLM_BASE_URL: Optional[str] = None
    LLM_TIMEOUT_SECONDS: float = 30.0
    LLM_MAX_RETRIES: int = 2
    LLM_MAX_INPUT_LENGTH: int = 2000
    LLM_MAX_OUTPUT_TOKENS: int = 1024
    LLM_TEMPERATURE: float = 0.1

    # Optional local Ollama adapter (never required for deployment or startup)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    # Authentication, Session & Password Recovery Settings
    SESSION_COOKIE_NAME: str = "campvion_session"
    CSRF_COOKIE_NAME: str = "campvion_csrf"
    SESSION_DURATION_HOURS: int = 24
    SESSION_REMEMBER_DAYS: int = 14
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    AUTH_MAX_FAILED_ATTEMPTS: int = 5
    AUTH_LOCKOUT_MINUTES: int = 15
    ALLOWED_EMAIL_DOMAINS: Optional[str] = None  # Comma-separated institutional domains if restricted

    # Optional SMTP / Transactional Email Provider Configuration
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "no-reply@campvion.edu"
    FRONTEND_BASE_URL: str = "http://localhost:3000"
    FRONTEND_URL: str = "*"

    model_config = SettingsConfigDict(
        env_file=(_ENV_FILE_PATH, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def effective_llm_api_key(self) -> Optional[str]:
        """Resolves API key prioritizing provider-specific key, then general LLM_API_KEY."""
        provider = (self.LLM_PROVIDER or "").lower()
        if provider == "groq" and self.GROQ_API_KEY:
            return self.GROQ_API_KEY
        if provider == "gemini" and self.GEMINI_API_KEY:
            return self.GEMINI_API_KEY
        if provider in ["openai", "openrouter"] and self.OPENAI_API_KEY:
            return self.OPENAI_API_KEY
        return self.LLM_API_KEY

    @property
    def effective_llm_model(self) -> str:
        """Resolves configured model identifier for the active provider."""
        provider = (self.LLM_PROVIDER or "").lower()
        if provider == "groq" and self.GROQ_MODEL:
            return self.GROQ_MODEL
        return self.LLM_MODEL

settings = Settings()
