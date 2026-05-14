#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# MyCPMentor Judge Sandbox – entrypoint
#
# Environment variables (set by docker run -e …):
#   CODE        Base64-encoded source code
#   LANGUAGE    python | cpp | javascript
#   TIME_LIMIT  Seconds (default 5)
#
# Stdin:         problem input (piped from the worker)
# Stdout:        program output
# Stderr:        compile/runtime error messages
#
# Exit codes (used by executor.py for verdict mapping):
#   0   → success (AC candidate – output comparison done externally)
#   2   → Compile Error (CE)
#   124 → Time Limit Exceeded (TLE)  – set by `timeout`
#   137 → Memory/OOM kill (MLE)      – set by the kernel OOM killer
#   1/other → Runtime Error (RE)
# ─────────────────────────────────────────────────────────────────────────────
set -e

LANG="${LANGUAGE:-python}"
TL="${TIME_LIMIT:-5}"
WORKSPACE="/workspace"

# ── 1. Decode source code ─────────────────────────────────────────────────────
if [ -z "$CODE" ]; then
    echo "SANDBOX ERROR: CODE env var is missing" >&2
    exit 1
fi

echo "$CODE" | base64 -d > "${WORKSPACE}/solution_raw"

# ── 2. Language-specific compile + run ────────────────────────────────────────
case "$LANG" in

  # ── Python ──────────────────────────────────────────────────────────────────
  python)
    cp "${WORKSPACE}/solution_raw" "${WORKSPACE}/solution.py"

    # Syntax check (fast CE detection before spending time on execution)
    if ! python3 -m py_compile "${WORKSPACE}/solution.py" 2>/tmp/ce.txt; then
        cat /tmp/ce.txt >&2
        exit 2
    fi

    exec timeout --signal=KILL "$TL" \
        python3 -u "${WORKSPACE}/solution.py"
    ;;

  # ── C++ ─────────────────────────────────────────────────────────────────────
  cpp)
    cp "${WORKSPACE}/solution_raw" "${WORKSPACE}/solution.cpp"

    # Compile
    if ! g++ -O2 -std=c++17 -o "${WORKSPACE}/sol" "${WORKSPACE}/solution.cpp" \
             2>/tmp/ce.txt; then
        cat /tmp/ce.txt >&2
        exit 2
    fi

    exec timeout --signal=KILL "$TL" "${WORKSPACE}/sol"
    ;;

  # ── JavaScript ──────────────────────────────────────────────────────────────
  javascript)
    cp "${WORKSPACE}/solution_raw" "${WORKSPACE}/solution.js"

    # Syntax check
    if ! node --check "${WORKSPACE}/solution.js" 2>/tmp/ce.txt; then
        cat /tmp/ce.txt >&2
        exit 2
    fi

    exec timeout --signal=KILL "$TL" node "${WORKSPACE}/solution.js"
    ;;

  *)
    echo "SANDBOX ERROR: unsupported language '$LANG'" >&2
    exit 1
    ;;
esac
