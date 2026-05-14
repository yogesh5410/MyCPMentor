"""
Celery task: generate_problem_task

Full pipeline:
  1. Generate problem statement + meta    (Groq llama-3.3-70b)
  2. Generate Python reference solution  (Groq llama-3.1-8b)
  3. Generate C++ reference solution     (Groq llama-3.1-8b)
  4. Generate test case generator script (Groq llama-3.1-8b)
  5. Execute tcgen in Docker sandbox     (judge-service)
  6. Run solution on each test case      (judge-service × N)
  7. Validate results                    (local)

Job state is written into Redis at every step so the frontend can poll progress.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

import redis as redis_lib

from app.config import get_settings
from app.core.generator import (
    generate_problem_statement,
    generate_python_solution,
    generate_cpp_solution,
    generate_tcgen_script,
)
from app.core.sandbox import run_tcgen, run_solution_on_testcases, validate_solution_with_sample
from app.core.validator import validate_problem
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


# ── Redis helpers ─────────────────────────────────────────────────────────────

def _redis() -> redis_lib.Redis:
    return redis_lib.from_url(get_settings().REDIS_URL, decode_responses=True)


def _job_key(job_id: str) -> str:
    return f"ai:job:{job_id}"


def _update_job(r: redis_lib.Redis, job_id: str, updates: dict) -> None:
    """Merge `updates` into the existing job JSON stored in Redis."""
    key = _job_key(job_id)
    raw = r.get(key)
    job: dict = json.loads(raw) if raw else {}
    job.update(updates)
    r.set(key, json.dumps(job), ex=get_settings().JOB_TTL_SECONDS)


# ── Main Celery task ──────────────────────────────────────────────────────────

@celery_app.task(name="ai.tasks.generate_problem", bind=True)
def generate_problem_task(
    self,
    job_id: str,
    topics: list,
    difficulty: int,
    idea: Optional[str],
) -> dict:
    """
    Orchestrate the full AI problem generation pipeline.

    All intermediate results are persisted to Redis so the REST endpoint
    can serve live progress to the frontend.
    """
    r = _redis()

    try:
        # ── Step 1: Problem statement ─────────────────────────────────────────
        _update_job(r, job_id, {
            "status": "generating_statement",
            "progress": 8,
            "current_step": "Calling Groq — generating problem statement…",
        })

        problem_data = generate_problem_statement(topics, difficulty, idea)

        _update_job(r, job_id, {
            "progress": 22,
            "current_step": "Problem statement generated ✓",
            "name": problem_data.get("name"),
            "description": problem_data.get("description"),
            "constraints": problem_data.get("constraints"),
            "input_format": problem_data.get("input_format"),
            "output_format": problem_data.get("output_format"),
            "sample_input": problem_data.get("sample_input"),
            "sample_output": problem_data.get("sample_output"),
            "sample_explanation": problem_data.get("sample_explanation"),
            "time_limit_ms": problem_data.get("time_limit_ms", 1000),
            "memory_limit_mb": problem_data.get("memory_limit_mb", 256),
            "time_complexity": problem_data.get("time_complexity"),
            "space_complexity": problem_data.get("space_complexity"),
            "tags": problem_data.get("tags", topics),
        })

        # ── Step 2: Python reference solution ────────────────────────────────
        _update_job(r, job_id, {
            "status": "generating_solution",
            "progress": 30,
            "current_step": "Calling Groq — generating Python reference solution…",
        })

        python_solution = generate_python_solution(problem_data)

        _update_job(r, job_id, {
            "progress": 42,
            "current_step": "Python solution generated ✓",
            "solution_code": python_solution,
            "solution_language": "python",
        })

        # ── Step 3: C++ reference solution ───────────────────────────────────
        _update_job(r, job_id, {
            "progress": 46,
            "current_step": "Calling Groq — generating C++ reference solution…",
        })

        cpp_solution = generate_cpp_solution(problem_data, python_solution)

        _update_job(r, job_id, {
            "progress": 56,
            "current_step": "C++ solution generated ✓",
            "solution_cpp": cpp_solution,
        })

        # ── Step 4b: Validate solution against sample input ─────────────────
        _update_job(r, job_id, {
            "progress": 57,
            "current_step": "Validating reference solution against sample input…",
        })

        validate_solution_with_sample(
            python_solution,
            problem_data.get("sample_input", ""),
            problem_data.get("sample_output", ""),
        )

        _update_job(r, job_id, {
            "progress": 59,
            "current_step": "Reference solution verified on sample input ✓",
        })

        # ── Step 4: Test case generator script ───────────────────────────────
        _update_job(r, job_id, {
            "status": "generating_tcgen",
            "progress": 60,
            "current_step": "Calling Groq — generating test case generator script…",
        })

        tcgen_script = generate_tcgen_script(problem_data, python_solution)

        _update_job(r, job_id, {
            "progress": 68,
            "current_step": "Test case generator script ready ✓",
            "tcgen_script": tcgen_script,
        })

        # ── Step 5: Execute test case generator in Docker ─────────────────────
        _update_job(r, job_id, {
            "status": "running_docker",
            "progress": 72,
            "current_step": "Running test case generator in Docker sandbox…",
        })

        raw_test_cases = run_tcgen(tcgen_script)

        _update_job(r, job_id, {
            "progress": 78,
            "current_step": f"Generator produced {len(raw_test_cases)} test case inputs ✓",
        })

        # ── Step 6: Run reference solution on each test case ─────────────────
        _update_job(r, job_id, {
            "progress": 80,
            "current_step": "Running reference solution against generated test cases…",
        })

        tl = max(1, min(problem_data.get("time_limit_ms", 1000) // 1000, 10))
        test_cases = run_solution_on_testcases(
            python_solution, raw_test_cases, language="python", problem_time_limit=tl
        )

        _update_job(r, job_id, {
            "progress": 92,
            "current_step": f"Collected {len(test_cases)} test cases with expected outputs ✓",
            "test_cases": test_cases,
        })

        # ── Step 7: Validate ──────────────────────────────────────────────────
        _update_job(r, job_id, {
            "status": "validating",
            "progress": 96,
            "current_step": "Validating generated problem…",
        })

        validation = validate_problem(problem_data, python_solution, cpp_solution, test_cases)

        # ── Done ──────────────────────────────────────────────────────────────
        _update_job(r, job_id, {
            "status": "completed",
            "progress": 100,
            "current_step": "Generation complete ✓",
            "validation_passed": validation["passed"],
            "validation_notes": validation["notes"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

        logger.info(f"Job {job_id} completed. Validation: {validation['passed']}")
        return {"job_id": job_id, "status": "completed"}

    except Exception as exc:
        logger.exception(f"Job {job_id} failed: {exc}")
        _update_job(r, job_id, {
            "status": "failed",
            "current_step": f"Failed: {str(exc)[:300]}",
            "error": str(exc)[:500],
        })
        return {"job_id": job_id, "status": "failed", "error": str(exc)}
