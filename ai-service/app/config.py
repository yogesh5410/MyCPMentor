"""
AI Service configuration — loaded from .env via pydantic-settings.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Groq ─────────────────────────────────────────────────────────────────
    GROQ_API_KEY: str

    # Quality model for problem statement generation (best reasoning)
    GROQ_MODEL_QUALITY: str = "llama-3.3-70b-versatile"
    # Code model for solution / test-gen (fast, great at code)
    GROQ_MODEL_CODE: str = "llama-3.1-8b-instant"

    # Seconds to sleep BEFORE each Groq call — keeps RPM safely below free-tier limit (30/min)
    GROQ_RPM_SLEEP: float = 5.0

    # ── Redis ────────────────────────────────────────────────────────────────
    # Uses DB 1 so it coexists with judge-service (DB 0) on the same Redis
    REDIS_URL: str = "redis://localhost:6379/1"

    # ── Judge service ────────────────────────────────────────────────────────
    JUDGE_SERVICE_URL: str = "http://localhost:8001"

    # ── Misc ─────────────────────────────────────────────────────────────────
    # Optional API key to protect this service's endpoints
    AI_API_KEY: str = ""

    # How long to keep job data in Redis (seconds)
    JOB_TTL_SECONDS: int = 86400  # 24 h

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
