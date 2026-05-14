"""
Celery task: judge_submission

Flow:
  1. Mark submission as "processing" in Redis
  2. For every test case: run in Docker sandbox
     • CE on the very first test case exits the loop early
  3. Aggregate results → overall verdict
  4. Persist final result in Redis (TTL = 1 h)

Overall verdict priority: CE > TLE > MLE > RE > WA > AC
"""

import json
import logging

import redis as redis_lib
from celery.exceptions import SoftTimeLimitExceeded

from app.config import get_settings
from app.core.executor import run_in_sandbox
from app.core.verdict import determine_verdict, exit_code_to_verdict
from app.core.stats import record_started, record_completed, record_failed
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

# Verdict priority for aggregation (lower index = higher priority)
_VERDICT_PRIORITY = ["CE", "TLE", "MLE", "RE", "WA", "AC"]


def _worse(a: str, b: str) -> str:
    """Return whichever verdict is worse (higher priority)."""
    pa = _VERDICT_PRIORITY.index(a) if a in _VERDICT_PRIORITY else 99
    pb = _VERDICT_PRIORITY.index(b) if b in _VERDICT_PRIORITY else 99
    return a if pa <= pb else b


def _get_redis() -> redis_lib.Redis:
    return redis_lib.from_url(get_settings().REDIS_URL, decode_responses=True)


def _store_status(r: redis_lib.Redis, submission_id: str, payload: dict) -> None:
    r.set(
        f"submission:{submission_id}:status",
        json.dumps(payload),
        ex=3600,
    )


@celery_app.task(
    bind=True,
    name="judge_submission",
    max_retries=1,
    default_retry_delay=5,
)
def judge_submission(self, submission_id: str, payload: dict) -> dict:
    """
    Main judge task.  `payload` mirrors SubmissionRequest.model_dump().
    """
    settings = get_settings()
    r = _get_redis()

    # ── Mark as processing ────────────────────────────────────────────────────
    _store_status(r, submission_id, {
        "submission_id": submission_id,
        "status": "processing",
    })
    record_started(submission_id)

    code         = payload["code"]
    language     = payload["language"]
    test_cases   = payload["test_cases"]
    time_limit   = min(payload.get("time_limit", settings.DEFAULT_TIME_LIMIT),
                       settings.MAX_TIME_LIMIT)
    memory_limit = min(payload.get("memory_limit", settings.DEFAULT_MEMORY_LIMIT),
                       settings.MAX_MEMORY_LIMIT)

    test_results  = []
    overall       = "AC"
    max_time_ms   = 0.0
    compile_error: str | None = None

    try:
        for idx, tc in enumerate(test_cases):
            exec_result = run_in_sandbox(
                code=code,
                language=language,
                stdin_data=tc["input"],
                time_limit=time_limit,
                memory_limit=memory_limit,
            )

            exit_code = exec_result["exit_code"]
            stdout    = exec_result.get("stdout", "")
            stderr    = exec_result.get("stderr", "")
            time_ms   = exec_result.get("time_ms", 0.0)
            is_hidden = tc.get("is_hidden", False)

            # ── CE: abort the whole submission immediately ─────────────────
            if exit_code == 2:
                compile_error = stderr
                overall = "CE"
                test_results.append({
                    "test_case_index": idx,
                    "verdict": "CE",
                    "time_ms": time_ms,
                    "stdout": None,
                    "stderr": stderr if not is_hidden else None,
                    "expected": None,
                })
                break

            verdict = determine_verdict(exit_code, stdout, tc["expected_output"])
            overall  = _worse(overall, verdict)
            max_time_ms = max(max_time_ms, time_ms)

            test_results.append({
                "test_case_index": idx,
                "verdict": verdict,
                "time_ms": round(time_ms, 2),
                # Mask output for hidden test cases
                "stdout":   stdout if not is_hidden else None,
                "stderr":   stderr if not is_hidden else None,
                "expected": tc["expected_output"] if not is_hidden else None,
            })

    except SoftTimeLimitExceeded:
        overall = "TLE"
        logger.warning("Task soft-time-limit hit for submission %s", submission_id)

    except Exception as exc:
        logger.exception("Unhandled error judging %s", submission_id)
        record_failed()
        _store_status(r, submission_id, {
            "submission_id": submission_id,
            "status": "failed",
            "error": str(exc),
        })
        raise self.retry(exc=exc)

    passed = sum(1 for t in test_results if t["verdict"] == "AC")

    result = {
        "submission_id": submission_id,
        "verdict":       overall,
        "total_tests":   len(test_cases),
        "passed_tests":  passed,
        "time_ms":       round(max_time_ms, 2),
        "compile_error": compile_error,
        "test_results":  test_results,
        "status":        "completed",
    }

    _store_status(r, submission_id, {
        "submission_id": submission_id,
        "status": "completed",
        "result": result,
    })

    record_completed(submission_id, overall, max_time_ms)
    logger.info(
        "Submission %s → %s  (%d/%d passed)",
        submission_id, overall, passed, len(test_cases),
    )
    return result
