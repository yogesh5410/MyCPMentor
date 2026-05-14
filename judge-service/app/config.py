from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Docker sandbox
    DOCKER_SANDBOX_IMAGE: str = "judge-sandbox:latest"

    # Execution limits
    MAX_TIME_LIMIT: int = 10   # seconds
    MAX_MEMORY_LIMIT: int = 512  # MB
    DEFAULT_TIME_LIMIT: int = 5
    DEFAULT_MEMORY_LIMIT: int = 256

    # Container startup overhead buffer (seconds)
    CONTAINER_OVERHEAD: int = 10

    # Internal auth
    JUDGE_API_KEY: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()
