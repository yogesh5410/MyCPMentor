"""
ai_service/test_runner.py

Executes Python test-case generator scripts in a sandboxed subprocess and
captures the generated test cases.

Why subprocess?
  The scripts are AI-generated and potentially untrusted code.  Running them
  in a subprocess with:
    - A short timeout (30 seconds) to prevent infinite loops
    - A memory cap via resource limits (UNIX only)
    - stdout captured for the generated test-case JSON
  gives us isolation without Docker (which would require root or DinD).

Script contract:
  Each script must print a single JSON array to stdout where each element is
  {"input": "...", "output": "..."}.  Example:
    [{"input": "5\n1 2 3 4 5", "output": "15"}]

  The AI is instructed to produce exactly this format.
"""

import asyncio
import json
import logging
import resource
import sys
import textwrap
from typing import List, Dict

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 30
MAX_MEMORY_MB = 256


def _set_resource_limits():
    """Called inside the child process to cap memory usage (Linux only)."""
    try:
        max_bytes = MAX_MEMORY_MB * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (max_bytes, max_bytes))
    except (resource.error, ValueError) as e:
        logger.warning(f"[TestRunner] Could not set memory limit: {e}")


async def run_test_case_script(script: str, expected_count: int) -> List[Dict[str, str]]:
    """
    Execute the given Python script in a subprocess and return the list of
    test cases it printed to stdout.

    Raises ValueError if:
      - The script times out
      - The script returns a non-zero exit code
      - The output is not valid JSON
      - The number of test cases doesn't match expected_count
    """
    # Wrap the script to ensure it prints JSON only
    wrapped = textwrap.dedent(
        f"""
import sys, json

def main():
{textwrap.indent(script, '    ')}

result = main()
if result is not None:
    print(json.dumps(result))
"""
    )

    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-c",
            wrapped,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            # preexec_fn sets resource limits in the child process
            **({"preexec_fn": _set_resource_limits} if sys.platform != "win32" else {}),
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            raise ValueError(
                f"Test-case script timed out after {TIMEOUT_SECONDS} seconds."
            )

        if proc.returncode != 0:
            err_snippet = stderr.decode("utf-8", errors="replace")[:800]
            raise ValueError(
                f"Test-case script exited with code {proc.returncode}.\nStderr:\n{err_snippet}"
            )

        # The script may have printed extra lines; extract the last valid JSON array
        output = stdout.decode("utf-8", errors="replace").strip()
        # Find the JSON array boundary (last '[' ... ']' block)
        start = output.rfind("[")
        end = output.rfind("]")
        if start == -1 or end == -1 or end < start:
            raise ValueError(
                f"Script did not print a JSON array.\nOutput (first 500):\n{output[:500]}"
            )

        json_str = output[start : end + 1]
        test_cases = json.loads(json_str)

        if not isinstance(test_cases, list):
            raise ValueError("Script output must be a JSON array.")

        # Validate shape
        for i, tc in enumerate(test_cases):
            if not isinstance(tc, dict) or "input" not in tc or "output" not in tc:
                raise ValueError(
                    f"Test case {i} must have 'input' and 'output' keys. Got: {tc}"
                )

        if len(test_cases) != expected_count:
            # Try to fix by trimming or padding — but better to error and retry
            raise ValueError(
                f"Expected {expected_count} test cases but script produced {len(test_cases)}."
            )

        return test_cases

    except json.JSONDecodeError as e:
        raise ValueError(f"Script output is not valid JSON: {e}") from e
