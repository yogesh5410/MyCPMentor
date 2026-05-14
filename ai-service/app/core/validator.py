"""
Validator for the fully generated problem.

Checks that all required pieces are present and that the test-case counts
satisfy the Problem schema requirements (2 public, 10 private).
"""

from typing import Optional


def validate_problem(
    problem_data: dict,
    python_solution: str,
    cpp_solution: str,
    test_cases: list,
) -> dict:
    """
    Run a suite of basic sanity checks on a generated problem.

    Returns:
        {
          "passed": bool,
          "notes": str,        # human-readable summary
          "public_count": int,
          "private_count": int,
          "warnings": [str],   # non-fatal issues
        }
    """
    errors: list[str] = []
    warnings: list[str] = []

    # ── Problem statement ────────────────────────────────────────────────────
    name = (problem_data.get("name") or "").strip()
    if not name:
        errors.append("Problem name is missing")
    elif len(name) < 3:
        errors.append(f"Problem name too short: '{name}'")

    if len(problem_data.get("description", "")) < 50:
        errors.append("Problem description is too short (< 50 chars)")

    for field in ("constraints", "input_format", "output_format"):
        if not (problem_data.get(field) or "").strip():
            errors.append(f"Missing required field: {field}")

    for field in ("sample_input", "sample_output"):
        if not (problem_data.get(field) or "").strip():
            warnings.append(f"Missing {field} — problem may be confusing for users")

    # ── Solutions ────────────────────────────────────────────────────────────
    if not python_solution or len(python_solution) < 20:
        errors.append("Python reference solution is missing or too short")

    if not cpp_solution or len(cpp_solution) < 20:
        warnings.append("C++ reference solution is missing or too short")

    # ── Test cases ───────────────────────────────────────────────────────────
    public_tcs = [tc for tc in test_cases if not tc.get("is_hidden")]
    private_tcs = [tc for tc in test_cases if tc.get("is_hidden")]

    if len(public_tcs) < 2:
        errors.append(
            f"Need ≥ 2 public test cases for publicTests (got {len(public_tcs)})"
        )
    if len(private_tcs) < 10:
        errors.append(
            f"Need ≥ 10 private test cases for privateTests (got {len(private_tcs)})"
        )

    # Check for empty expected outputs
    empty = [i for i, tc in enumerate(test_cases) if not (tc.get("expected_output") or "").strip()]
    if empty:
        errors.append(f"Test cases with empty expected output: indices {empty[:5]}")

    # ── Build report ─────────────────────────────────────────────────────────
    passed = len(errors) == 0
    if passed and warnings:
        notes = "Passed with warnings: " + "; ".join(warnings)
    elif passed:
        notes = "All validation checks passed ✓"
    else:
        notes = "FAILED: " + "; ".join(errors)
        if warnings:
            notes += " | Warnings: " + "; ".join(warnings)

    return {
        "passed": passed,
        "notes": notes,
        "public_count": len(public_tcs),
        "private_count": len(private_tcs),
        "warnings": warnings,
    }
