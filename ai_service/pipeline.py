"""
ai_service/pipeline.py

5-Stage AI problem generation pipeline.

Stage 1: Generate problem statement (title, description, constraints, limits, complexity)
Stage 2: Generate C++ solution
Stage 3: Generate Python test-case generator scripts (2 public + 10 private)
Stage 4: Execute the scripts to produce actual test cases
Stage 5: LLM review — validate everything is consistent and correct

Each stage saves its output to MongoDB (via the db module) so progress is never
lost if the worker crashes mid-run.  On retry, completed stages are skipped.

Rate-limit strategy:
  - 5 API calls total (1 per stage)
  - 4 calls per problem (stages 1-3 + 5; stage 4 is local execution)
  - At 15 RPM free tier this takes ~16 seconds minimum 
  - tenacity retries handle 429s automatically (see gemini_client.py)
"""

import asyncio
import logging
from typing import Any, Dict

from gemini_client import call_gemini_json, call_gemini_text
from test_runner import run_test_case_script
from prompts import (
    prompt_generate_statement,
    prompt_generate_solution,
    prompt_generate_test_scripts,
    prompt_review_problem,
)

logger = logging.getLogger(__name__)


class PipelineError(Exception):
    """Raised when a stage fails and we want to surface the failing stage name."""
    def __init__(self, stage: str, message: str):
        self.stage = stage
        super().__init__(message)


async def _run_statement_stage(prompt: str, request_id: str, db) -> Dict[str, Any]:
    logger.info(f"[{request_id}] Stage 1: Generating problem statement...")
    await db.update_stage(request_id, "statement")

    try:
        data = await call_gemini_json(prompt_generate_statement(prompt))
    except Exception as e:
        raise PipelineError("statement", f"Statement generation failed: {e}") from e

    _validate_keys(data, ["title", "description", "constraints", "timeLimitMs",
                          "memoryLimitMb", "optimalTimeComplexity",
                          "optimalSpaceComplexity", "difficulty", "tags"],
                  stage="statement")

    await db.save_statement(request_id, data)
    logger.info(f"[{request_id}] Stage 1 complete: '{data['title']}'")
    return data


async def _run_solution_stage(statement: Dict, request_id: str, db) -> str:
    logger.info(f"[{request_id}] Stage 2: Generating C++ solution...")
    await db.update_stage(request_id, "solution")

    try:
        data = await call_gemini_json(prompt_generate_solution(statement))
    except Exception as e:
        raise PipelineError("solution", f"Solution generation failed: {e}") from e

    _validate_keys(data, ["solutionCpp"], stage="solution")
    solution_cpp = data["solutionCpp"]

    if len(solution_cpp.strip()) < 50:
        raise PipelineError("solution", "Generated C++ solution is too short to be valid.")

    await db.save_solution(request_id, solution_cpp)
    logger.info(f"[{request_id}] Stage 2 complete.")
    return solution_cpp


async def _run_test_scripts_stage(statement: Dict, solution_cpp: str, request_id: str, db) -> Dict:
    logger.info(f"[{request_id}] Stage 3: Generating test-case scripts...")
    await db.update_stage(request_id, "test_scripts")

    try:
        data = await call_gemini_json(prompt_generate_test_scripts(statement, solution_cpp))
    except Exception as e:
        raise PipelineError("test_scripts", f"Test-script generation failed: {e}") from e

    _validate_keys(data, ["publicScript", "privateScript"], stage="test_scripts")

    await db.save_test_scripts(request_id, data["publicScript"], data["privateScript"])
    logger.info(f"[{request_id}] Stage 3 complete.")
    return data


async def _run_test_execution_stage(scripts: Dict, request_id: str, db) -> Dict:
    logger.info(f"[{request_id}] Stage 4: Executing test-case scripts...")
    await db.update_stage(request_id, "test_execution")

    try:
        public_tests = await run_test_case_script(scripts["publicScript"], expected_count=2)
        private_tests = await run_test_case_script(scripts["privateScript"], expected_count=10)
    except ValueError as e:
        raise PipelineError("test_execution", str(e)) from e

    await db.save_test_cases(request_id, public_tests, private_tests)
    logger.info(f"[{request_id}] Stage 4 complete: 2 public + 10 private test cases.")
    return {"publicTests": public_tests, "privateTests": private_tests}


async def _run_review_stage(
    statement: Dict,
    solution_cpp: str,
    test_cases: Dict,
    request_id: str,
    db,
) -> Dict:
    logger.info(f"[{request_id}] Stage 5: LLM review...")
    await db.update_stage(request_id, "review")

    try:
        data = await call_gemini_json(
            prompt_review_problem(
                statement,
                solution_cpp,
                test_cases["publicTests"],
                test_cases["privateTests"],
            )
        )
    except Exception as e:
        raise PipelineError("review", f"Review stage failed: {e}") from e

    _validate_keys(data, ["passed", "notes"], stage="review")

    await db.save_review(request_id, data["passed"], data["notes"])
    logger.info(f"[{request_id}] Stage 5 complete. Passed={data['passed']}")
    return data


# ── Main Pipeline Entry Point ─────────────────────────────────────────────────

async def run_pipeline(request_id: str, prompt: str, db) -> Dict[str, Any]:
    """
    Run the full 5-stage pipeline for a single problem-generation job.

    Returns a dict with all generated data, ready to be stored as a Problem doc.
    Raises PipelineError on any stage failure (caller handles DB update + refund).
    """
    # Check if any stages are already completed (resume after crash)
    existing = await db.get_request(request_id)
    generations = existing.get("generations", {}) if existing else {}

    # Stage 1 — Statement (skip if already done)
    if generations.get("statement", {}).get("title"):
        logger.info(f"[{request_id}] Stage 1 already complete. Resuming...")
        statement = generations["statement"]
    else:
        statement = await _run_statement_stage(prompt, request_id, db)

    # Stage 2 — Solution (skip if already done)
    if generations.get("solution", {}).get("solutionCpp"):
        logger.info(f"[{request_id}] Stage 2 already complete. Resuming...")
        solution_cpp = generations["solution"]["solutionCpp"]
    else:
        solution_cpp = await _run_solution_stage(statement, request_id, db)

    # Stage 3 — Test scripts (skip if already done)
    if (
        generations.get("testCaseScripts", {}).get("publicScript")
        and generations.get("testCaseScripts", {}).get("privateScript")
    ):
        logger.info(f"[{request_id}] Stage 3 already complete. Resuming...")
        scripts = generations["testCaseScripts"]
    else:
        scripts = await _run_test_scripts_stage(statement, solution_cpp, request_id, db)

    # Stage 4 — Execute scripts (always re-run — deterministic and cheap)
    test_cases = await _run_test_execution_stage(scripts, request_id, db)

    # Stage 5 — Review
    review = await _run_review_stage(statement, solution_cpp, test_cases, request_id, db)

    await db.update_stage(request_id, "done")

    return {
        "statement": statement,
        "solutionCpp": solution_cpp,
        "publicTests": test_cases["publicTests"],
        "privateTests": test_cases["privateTests"],
        "review": review,
    }


# ── Utility ───────────────────────────────────────────────────────────────────

def _validate_keys(data: Any, required_keys: list, stage: str) -> None:
    if not isinstance(data, dict):
        raise PipelineError(stage, f"Expected JSON object but got {type(data).__name__}.")
    missing = [k for k in required_keys if k not in data]
    if missing:
        raise PipelineError(stage, f"Missing keys in response: {missing}")
