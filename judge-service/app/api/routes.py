"""
Judge Service API routes.

Endpoints:
  POST /api/judge/submit        Async submission → queued via Celery
  GET  /api/judge/status/{id}   Poll submission result
  POST /api/judge/judge-sync    Synchronous judgment (blocks until done)
  GET  /api/judge/health        Redis / service health check
  GET  /api/judge/monitoring    Queue depth + worker stats
"""

import json
import logging
import time

import redis as redis_lib
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.core.executor import run_in_sandbox
from app.core.verdict import determine_verdict
from app.core.stats import record_queued, get_full_stats
from app.models import (
    JudgeResult,
    StatusResponse,
    SubmissionRequest,
    SubmitResponse,
    TestCaseResult,
)
from app.worker.tasks import judge_submission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/judge", tags=["Judge"])

_VERDICT_PRIORITY = ["CE", "TLE", "MLE", "RE", "WA", "AC"]


def _worse(a: str, b: str) -> str:
    pa = _VERDICT_PRIORITY.index(a) if a in _VERDICT_PRIORITY else 99
    pb = _VERDICT_PRIORITY.index(b) if b in _VERDICT_PRIORITY else 99
    return a if pa <= pb else b


def _get_redis() -> redis_lib.Redis:
    return redis_lib.from_url(get_settings().REDIS_URL, decode_responses=True)


# ── POST /api/judge/submit ─────────────────────────────────────────────────────

def _submit_to_queue(submission: SubmissionRequest) -> None:
    """Fire-and-forget: enqueue the judge task, set initial Redis state."""
    r = _get_redis()
    r.set(
        f"submission:{submission.submission_id}:status",
        json.dumps({"submission_id": submission.submission_id, "status": "pending"}),
        ex=3600,
    )
    record_queued(submission.submission_id, submission.language.value)
    judge_submission.delay(
        submission_id=submission.submission_id,
        payload=submission.model_dump(),
    )


async def submit_async(submission: SubmissionRequest, bg: BackgroundTasks):
    bg.add_task(_submit_to_queue, submission)
    return SubmitResponse(submission_id=submission.submission_id, status="pending")


router.post("/submit", response_model=SubmitResponse)(submit_async)


# ── GET /api/judge/status/{submission_id} ──────────────────────────────────────

async def get_status(submission_id: str):
    r = _get_redis()
    raw = r.get(f"submission:{submission_id}:status")
    if not raw:
        raise HTTPException(status_code=404, detail="Submission not found")
    data = json.loads(raw)
    return StatusResponse(**data) if "result" in data else {"submission_id": submission_id, **data}


router.get("/status/{submission_id}")(get_status)


# ── POST /api/judge/judge-sync ─────────────────────────────────────────────────

async def judge_sync(submission: SubmissionRequest):
    """
    Synchronous judge – useful for run/test-run calls where the client
    waits for the result.  Skips Celery; runs directly in the API process.
    """
    settings = get_settings()
    time_limit   = min(submission.time_limit,   settings.MAX_TIME_LIMIT)
    memory_limit = min(submission.memory_limit, settings.MAX_MEMORY_LIMIT)

    test_results: list[TestCaseResult] = []
    overall      = "AC"
    max_time_ms  = 0.0
    compile_error: str | None = None

    for idx, tc in enumerate(submission.test_cases):
        exec_result = run_in_sandbox(
            code=submission.code,
            language=submission.language.value,
            stdin_data=tc.input,
            time_limit=time_limit,
            memory_limit=memory_limit,
        )

        exit_code = exec_result["exit_code"]
        stdout    = exec_result.get("stdout", "")
        stderr    = exec_result.get("stderr", "")
        time_ms   = exec_result.get("time_ms", 0.0)

        if exit_code == 2:        # CE – stop immediately
            compile_error = stderr
            overall = "CE"
            test_results.append(TestCaseResult(
                test_case_index=idx,
                verdict="CE",
                time_ms=round(time_ms, 2),
                stderr=stderr if not tc.is_hidden else None,
            ))
            break

        verdict = determine_verdict(exit_code, stdout, tc.expected_output)
        overall  = _worse(overall, verdict)
        max_time_ms = max(max_time_ms, time_ms)

        test_results.append(TestCaseResult(
            test_case_index=idx,
            verdict=verdict,
            time_ms=round(time_ms, 2),
            stdout=stdout           if not tc.is_hidden else None,
            stderr=stderr or None   if not tc.is_hidden else None,
            expected=tc.expected_output if not tc.is_hidden else None,
        ))

    passed = sum(1 for t in test_results if t.verdict == "AC")

    return JudgeResult(
        submission_id=submission.submission_id,
        verdict=overall,
        total_tests=len(submission.test_cases),
        passed_tests=passed,
        time_ms=round(max_time_ms, 2),
        compile_error=compile_error,
        test_results=test_results,
        status="completed",
    )


router.post("/judge-sync", response_model=JudgeResult)(judge_sync)


# ── GET /api/judge/health ──────────────────────────────────────────────────────

async def health():
    redis_ok = False
    try:
        r = _get_redis()
        r.ping()
        redis_ok = True
    except Exception:
        pass

    return JSONResponse(
        status_code=200 if redis_ok else 503,
        content={
            "service": "judge-service",
            "status":  "ok" if redis_ok else "degraded",
            "redis":   "connected" if redis_ok else "disconnected",
        },
    )


router.get("/health")(health)


# ── GET /api/judge/monitoring ──────────────────────────────────────────────────

async def monitoring():
    """Return comprehensive judge-service telemetry for the admin dashboard."""
    try:
        from celery.app.control import Inspect
        from app.worker.celery_app import celery_app as _celery

        # ── Celery worker introspection ───────────────────────────────────────
        inspector: Inspect = _celery.control.inspect(timeout=2)
        active    = inspector.active()    or {}
        reserved  = inspector.reserved()  or {}
        stats_raw = inspector.stats()     or {}

        workers = []
        for w_name, tasks in active.items():
            pool = stats_raw.get(w_name, {}).get("pool", {})
            workers.append({
                "name":       w_name,
                "active_jobs": len(tasks),
                "capacity":    pool.get("max-concurrency", "?"),
                "processes":   pool.get("processes", []),
                "active_tasks": [
                    {
                        "id":   t.get("id", ""),
                        "name": t.get("name", ""),
                        "time_start": t.get("time_start"),
                        "worker_pid": t.get("worker_pid"),
                    }
                    for t in tasks
                ],
            })

        pending = sum(len(t) for t in reserved.values())

        # ── Full Redis-backed stats ───────────────────────────────────────────
        full = get_full_stats()

        # Override in_progress with live Celery data if available
        live_active = sum(len(t) for t in active.values())
        full["counters"]["in_progress"] = live_active
        full["counters"]["pending_queue"] = pending

        # ── Redis health ──────────────────────────────────────────────────────
        redis_ok = False
        try:
            _get_redis().ping()
            redis_ok = True
        except Exception:
            pass

        return {
            "status":  "ok" if redis_ok else "degraded",
            "redis_ok": redis_ok,
            "workers":  workers,
            "worker_count": len(workers),
            **full,
        }

    except Exception as exc:
        logger.warning("Monitoring probe failed: %s", exc)
        # Still return available Redis stats even if Celery is unreachable
        try:
            full = get_full_stats()
            return {"status": "degraded", "redis_ok": True, "workers": [], "worker_count": 0, **full}
        except Exception:
            return {"status": "unavailable", "redis_ok": False, "workers": [], "worker_count": 0}


router.get("/monitoring")(monitoring)
