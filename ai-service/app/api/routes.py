"""
FastAPI routes for the AI Problem Generation Service.

Endpoints:
  GET  /api/ai/health              Service + Redis health check
  POST /api/ai/generate            Queue a new problem generation job
  GET  /api/ai/jobs/{job_id}       Poll job status + full generated content
  GET  /api/ai/jobs                List recent jobs (summary only)
"""

import json
import logging
import uuid
from datetime import datetime, timezone

import redis as redis_lib
from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models import GenerationRequest, EnqueueResponse
from app.worker.tasks import generate_problem_task

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["AI Problem Generation"])


# ── Redis helper ──────────────────────────────────────────────────────────────

def _redis() -> redis_lib.Redis:
    return redis_lib.from_url(get_settings().REDIS_URL, decode_responses=True)


# ── GET /api/ai/health ────────────────────────────────────────────────────────

@router.get("/health")
def health():
    r = _redis()
    try:
        r.ping()
        redis_ok = True
    except Exception as exc:
        redis_ok = False
        logger.error(f"Redis ping failed: {exc}")

    return {
        "status": "ok" if redis_ok else "degraded",
        "redis": redis_ok,
        "service": "ai-problem-service",
    }


# ── POST /api/ai/generate ─────────────────────────────────────────────────────

@router.post("/generate", response_model=EnqueueResponse, status_code=202)
def generate_problem(req: GenerationRequest):
    """
    Queue a new problem generation job.
    Returns immediately with a job_id that the client can poll.
    """
    job_id = f"ai_{uuid.uuid4().hex[:14]}"
    now = datetime.now(timezone.utc).isoformat()

    initial_state = {
        "job_id": job_id,
        "status": "queued",
        "progress": 0,
        "current_step": "Queued — waiting for Celery worker",
        "topics": req.topics,
        "difficulty": req.difficulty,
        "idea": req.idea,
        "created_at": now,
        "test_cases": [],
    }

    r = _redis()
    r.set(
        f"ai:job:{job_id}",
        json.dumps(initial_state),
        ex=get_settings().JOB_TTL_SECONDS,
    )

    # Dispatch to Celery worker
    generate_problem_task.delay(job_id, req.topics, req.difficulty, req.idea)

    logger.info(f"Queued job {job_id} — topics={req.topics}, difficulty={req.difficulty}")
    return EnqueueResponse(job_id=job_id, status="queued", created_at=now)


# ── GET /api/ai/jobs/{job_id} ─────────────────────────────────────────────────

@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    """Return the full current state of a generation job."""
    r = _redis()
    raw = r.get(f"ai:job:{job_id}")
    if not raw:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return json.loads(raw)


# ── GET /api/ai/jobs ──────────────────────────────────────────────────────────

@router.get("/jobs")
def list_jobs(limit: int = 30):
    """Return a summary list of recent generation jobs (newest first)."""
    r = _redis()
    keys = r.keys("ai:job:*")

    jobs = []
    for key in keys:
        raw = r.get(key)
        if not raw:
            continue
        data = json.loads(raw)
        jobs.append(
            {
                "job_id": data.get("job_id"),
                "status": data.get("status"),
                "progress": data.get("progress", 0),
                "name": data.get("name"),
                "difficulty": data.get("difficulty"),
                "topics": data.get("topics", []),
                "validation_passed": data.get("validation_passed"),
                "created_at": data.get("created_at"),
                "completed_at": data.get("completed_at"),
            }
        )

    # Sort newest first
    jobs.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"jobs": jobs[:limit], "total": len(jobs)}
