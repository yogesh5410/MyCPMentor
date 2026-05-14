"""
Sandbox execution — calls the judge-service HTTP API to run code in Docker.

Two public functions:
  run_tcgen(script)                        → list of {"input": str}
  run_solution_on_testcases(code, tcs)     → list of {"input", "expected_output", "is_hidden"}
"""

import logging
import time
import uuid

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_TC_DELIMITER = "---TC---"


# ── Low-level: single HTTP call to judge-service ──────────────────────────────

def _judge_sync(
    code: str,
    language: str,
    test_cases: list,
    time_limit: int = 10,
) -> dict:
    """POST to /api/judge/judge-sync and return the JSON response."""
    settings = get_settings()
    payload = {
        "submission_id": f"ai_{uuid.uuid4().hex[:10]}",
        "user_id": "ai-service",
        "problem_id": "ai-gen",
        "code": code,
        "language": language,
        "test_cases": test_cases,
        "time_limit": min(max(time_limit, 1), 10),  # clamp to judge-service range
        "memory_limit": 256,
    }
    with httpx.Client(timeout=180.0) as client:
        resp = client.post(
            f"{settings.JUDGE_SERVICE_URL}/api/judge/judge-sync",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


# ── Step 4 execution: run test case generator ────────────────────────────────

def run_tcgen(tcgen_script: str) -> list:
    """
    Execute the test case generator script in the judge-service Docker sandbox.

    The script is expected to print test cases separated by '---TC---' lines.
    Returns a list: [{"input": str}, ...]
    """
    result = _judge_sync(
        code=tcgen_script,
        language="python",
        test_cases=[
            {
                "input": "",
                # Placeholder expected — we only care about stdout
                "expected_output": "__TCGEN_SKIP__",
                "is_hidden": False,
            }
        ],
        time_limit=10,
    )

    if result.get("verdict") == "CE":
        raise RuntimeError(
            f"Test case generator compile error:\n{result.get('compile_error', 'unknown error')}"
        )

    test_results = result.get("test_results") or []
    if not test_results:
        raise RuntimeError("Judge-service returned no test_results for tcgen execution")

    stdout = (test_results[0].get("stdout") or "").strip()
    if not stdout:
        stderr = (test_results[0].get("stderr") or "")[:300]
        raise RuntimeError(
            f"Test case generator produced empty stdout.\nStderr: {stderr}"
        )

    # Parse "---TC---" delimited blocks
    parts = [p.strip() for p in stdout.split(_TC_DELIMITER) if p.strip()]
    if len(parts) < 3:
        raise RuntimeError(
            f"Generator produced only {len(parts)} test case(s) (need ≥ 3).\n"
            f"Stdout preview: {stdout[:400]}"
        )

    logger.info(f"Test case generator produced {len(parts)} test cases")
    return [{"input": tc} for tc in parts[:15]]  # cap at 15 to avoid abuse


# ── Step 4b: Pre-validate solution against sample input ──────────────────────

def validate_solution_with_sample(
    solution_code: str,
    sample_input: str,
    sample_output: str,
    language: str = "python",
) -> None:
    """
    Run the reference solution against the sample input/output.
    Raises RuntimeError if solution CE's, RE's or produces wrong output.
    Used to catch broken solutions early before running all tcgen test cases.
    """
    result = _judge_sync(
        code=solution_code,
        language=language,
        test_cases=[
            {
                "input": sample_input.strip(),
                "expected_output": sample_output.strip(),
                "is_hidden": False,
            }
        ],
        time_limit=10,
    )

    if result.get("verdict") == "CE":
        raise RuntimeError(
            f"Reference solution compile error on sample input:\n"
            f"{result.get('compile_error', 'unknown')}"
        )

    tc_result = (result.get("test_results") or [{}])[0]
    verdict = tc_result.get("verdict", "")
    stdout = (tc_result.get("stdout") or "").strip()

    if verdict == "RE":
        stderr = (tc_result.get("stderr") or "")[:300]
        raise RuntimeError(
            f"Reference solution crashed on sample input (RE).\n"
            f"Stderr: {stderr}\n"
            f"Input was:\n{sample_input[:200]}"
        )
    if verdict == "TLE":
        raise RuntimeError("Reference solution timed out on sample input (TLE).")
    if verdict == "WA":
        raise RuntimeError(
            f"Reference solution gave wrong answer on sample input.\n"
            f"Expected: {sample_output.strip()[:100]}\n"
            f"Got:      {stdout[:100]}"
        )

    logger.info("Reference solution passed sample input validation ✓")


# ── Step 5 execution: run reference solution on each test case ────────────────

def run_solution_on_testcases(
    solution_code: str,
    test_cases_raw: list,
    language: str = "python",
    problem_time_limit: int = 5,
) -> list:
    """
    Run the reference solution on every generated test case to collect expected outputs.

    • First 2 test cases are marked is_hidden=False  (become publicTests in Problem model)
    • The rest are marked is_hidden=True             (become privateTests)
    • Test cases causing TLE / MLE / RE are skipped (logged as warnings)

    Returns: [{"input": str, "expected_output": str, "is_hidden": bool}, ...]
    """
    results = []
    tl = min(max(problem_time_limit, 1), 10)

    for i, tc in enumerate(test_cases_raw):
        tc_input = tc["input"]
        time.sleep(0.4)  # small pause between Docker launches

        try:
            result = _judge_sync(
                code=solution_code,
                language=language,
                test_cases=[
                    {
                        "input": tc_input,
                        # Placeholder — we need the stdout, not the verdict
                        "expected_output": "__EXPECTED_OUTPUT__",
                        "is_hidden": False,
                    }
                ],
                time_limit=tl,
            )
        except httpx.HTTPError as exc:
            logger.warning(f"Judge-service HTTP error on TC {i + 1}: {exc}, skipping")
            continue

        if result.get("verdict") == "CE":
            # CE on reference solution is a hard error — surface it immediately
            raise RuntimeError(
                f"Reference solution compile error on TC {i + 1}:\n"
                f"{result.get('compile_error', 'unknown')}"
            )

        tc_result = (result.get("test_results") or [{}])[0]
        verdict = tc_result.get("verdict", "")

        if verdict in ("TLE", "MLE", "RE"):
            logger.warning(f"TC {i + 1} gave {verdict} — skipping this test case")
            continue

        stdout = (tc_result.get("stdout") or "").strip()
        results.append(
            {
                "input": tc_input,
                "expected_output": stdout,
                # TC 0 and 1 (first two) → public; the rest → hidden
                "is_hidden": i >= 2,
            }
        )

    if len(results) < 3:
        raise RuntimeError(
            f"Only {len(results)} test case(s) passed execution (need ≥ 3). "
            "Check that the reference solution is correct."
        )

    logger.info(f"Collected {len(results)} test cases with expected outputs")
    return results
