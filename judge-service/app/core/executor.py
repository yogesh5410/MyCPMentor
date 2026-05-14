"""
Docker-based secure sandbox executor.

Each call to `run_in_sandbox()` spins up a fresh, locked-down container,
feeds the problem input through stdin, collects stdout/stderr, and
destroys the container.  The worker / route layer is responsible for
iterating over test cases and aggregating verdicts.

Security flags applied to every container:
  --network none              no outbound network
  --read-only                 immutable root filesystem
  --tmpfs /workspace:rw,exec  writable scratch space for the compiled binary
  --tmpfs /tmp:rw,exec        writable /tmp (some runtimes need it)
  --memory / --memory-swap    hard RAM cap
  --cpus 1.0                  bound to one logical CPU
  --pids-limit 50             prevent fork-bomb
  --cap-drop ALL              drop all Linux capabilities
  --security-opt no-new-privileges
"""

import base64
import logging
import subprocess
import time
import uuid
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


def run_in_sandbox(
    *,
    code: str,
    language: str,
    stdin_data: str,
    time_limit: int,
    memory_limit: int,
) -> dict[str, Any]:
    """
    Execute `code` inside an isolated Docker container.

    Returns:
        {
            "exit_code": int,
            "stdout":    str,
            "stderr":    str,
            "time_ms":   float,
        }
    """
    settings = get_settings()
    image = settings.DOCKER_SANDBOX_IMAGE

    # Unique container name so we can force-kill it on timeout
    container_name = f"judge-{uuid.uuid4().hex[:16]}"

    # Base64-encode the source so it survives shell quoting
    code_b64 = base64.b64encode(code.encode("utf-8")).decode("ascii")

    cmd = [
        "docker", "run",
        "--rm",
        "--interactive",
        "--name", container_name,

        # ── Network isolation ────────────────────────────────────────────────
        "--network", "none",

        # ── Filesystem isolation ─────────────────────────────────────────────
        "--read-only",
        "--tmpfs", "/workspace:rw,exec,size=128m,mode=0777",
        "--tmpfs", "/tmp:rw,exec,size=32m,mode=0777",

        # ── Resource limits ──────────────────────────────────────────────────
        "--memory",      f"{memory_limit}m",
        "--memory-swap", f"{memory_limit}m",   # disable swap entirely
        "--cpus",        "1.0",
        "--pids-limit",  "50",

        # ── Privilege drop ───────────────────────────────────────────────────
        "--cap-drop",    "ALL",
        "--security-opt", "no-new-privileges",

        # ── Environment passed to entrypoint ─────────────────────────────────
        "-e", f"CODE={code_b64}",
        "-e", f"LANGUAGE={language}",
        "-e", f"TIME_LIMIT={time_limit}",

        image,
    ]

    # Give the container `time_limit` seconds of actual execution plus a fixed
    # overhead for startup/shutdown so the subprocess timeout never fires for
    # a well-behaved run.
    wall_timeout = time_limit + settings.CONTAINER_OVERHEAD
    start = time.perf_counter()

    try:
        proc = subprocess.run(
            cmd,
            input=stdin_data.encode("utf-8"),
            capture_output=True,
            timeout=wall_timeout,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000

        return {
            "exit_code": proc.returncode,
            "stdout":    proc.stdout.decode("utf-8", errors="replace"),
            "stderr":    proc.stderr.decode("utf-8", errors="replace"),
            "time_ms":   elapsed_ms,
        }

    except subprocess.TimeoutExpired:
        elapsed_ms = (time.perf_counter() - start) * 1000
        # Force-kill the container (best-effort; it may already be gone)
        _kill_container(container_name)
        return {
            "exit_code": 124,          # TLE sentinel
            "stdout":    "",
            "stderr":    "Execution timed out (wall-clock limit exceeded)",
            "time_ms":   elapsed_ms,
        }

    except Exception as exc:
        logger.exception("Unexpected error running sandbox container %s", container_name)
        return {
            "exit_code": -1,
            "stdout":    "",
            "stderr":    f"Internal executor error: {exc}",
            "time_ms":   (time.perf_counter() - start) * 1000,
        }


def _kill_container(name: str) -> None:
    try:
        subprocess.run(
            ["docker", "kill", name],
            capture_output=True,
            timeout=5,
        )
        subprocess.run(
            ["docker", "rm", "-f", name],
            capture_output=True,
            timeout=5,
        )
    except Exception:
        pass  # Best-effort cleanup
