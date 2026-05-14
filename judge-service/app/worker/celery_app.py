"""
Celery application factory.

Import this from tasks.py and from the CLI entry-point:
  celery -A app.worker.celery_app worker …
"""

from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "judge",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Reliability: acknowledge only after the task finishes so a worker crash
    # doesn't silently drop submissions.
    task_acks_late=True,
    worker_prefetch_multiplier=1,   # one task at a time per worker slot

    # Visibility tracking (allows polling /status/{id})
    task_track_started=True,

    # Hard time-limits per task (seconds)
    # soft limit: raises SoftTimeLimitExceeded inside the task
    # hard limit: sends SIGKILL to the worker process
    task_soft_time_limit=180,
    task_time_limit=240,

    # Result expiry – 1 hour is plenty for an async judge queue
    result_expires=3600,

    # Retry policy for transient broker errors
    broker_transport_options={"visibility_timeout": 300},
)
