"""
ai_service/config.py

Loads environment variables and exposes typed settings used across the service.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Gemini ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.environ["GEMINI_API_KEY"]
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# Free-tier rate limits (conservative to avoid 429s):
GEMINI_RPM_LIMIT: int = int(os.getenv("GEMINI_RPM_LIMIT", "14"))   # use 14/15 for safety
GEMINI_RPD_LIMIT: int = int(os.getenv("GEMINI_RPD_LIMIT", "1400")) # use 1400/1500

# ── RabbitMQ ──────────────────────────────────────────────────────────────────
RABBITMQ_URL: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
RABBITMQ_QUEUE: str = os.getenv("RABBITMQ_QUEUE", "problem_generation")

# ── MongoDB ───────────────────────────────────────────────────────────────────
MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/mycpmentor")
