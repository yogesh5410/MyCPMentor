"""
Celery application factory for the AI Problem Generation Service.
"""

from celery import Celery

from app.config import get_settings


def make_celery() -> Celery:
    settings = get_settings()
    app = Celery(
        "ai_worker",
        broker=settings.REDIS_URL,
        backend=settings.REDIS_URL,
        include=["app.worker.tasks"],
    )
    app.conf.update(
        task_acks_late=True,
        worker_prefetch_multiplier=1,   # one task at a time per worker
        task_track_started=True,
        # Generous limits: generation takes ~60-120 s total
        task_soft_time_limit=600,        # 10 min — sends SoftTimeLimitExceeded
        task_time_limit=720,             # 12 min hard kill
        result_expires=86400,            # keep results 24 h
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
    )
    return app


celery_app = make_celery()
