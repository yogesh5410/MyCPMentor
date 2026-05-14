"""
Output comparison and verdict mapping.

Exit-code → verdict table (must match sandbox/entrypoint.sh comments):
  0        → AC candidate  (compare stdout with expected)
  2        → CE
  124      → TLE
  137      → MLE (OOM-killed by kernel)
  other    → RE
"""

_VERDICT_MAP: dict[int, str] = {
    0: "AC",
    2: "CE",
    124: "TLE",
    137: "MLE",
}


def exit_code_to_verdict(exit_code: int) -> str:
    return _VERDICT_MAP.get(exit_code, "RE")


def normalize(s: str) -> str:
    """
    Normalise output for comparison:
    - Strip trailing whitespace from every line
    - Strip leading/trailing blank lines
    This matches most competitive-programming judge conventions.
    """
    lines = s.rstrip().split("\n")
    return "\n".join(line.rstrip() for line in lines)


def outputs_match(actual: str, expected: str) -> bool:
    return normalize(actual) == normalize(expected)


def determine_verdict(exit_code: int, stdout: str, expected_output: str) -> str:
    """
    Full verdict resolution for a single test-case execution result.
    """
    v = exit_code_to_verdict(exit_code)
    if v == "AC":
        if not outputs_match(stdout, expected_output):
            v = "WA"
    return v
