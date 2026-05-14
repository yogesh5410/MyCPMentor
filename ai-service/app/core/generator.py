"""
Multi-step AI agent for generating Codeforces-style competitive programming problems.

Pipeline (all synchronous for Celery compatibility):
  Step 1 — generate_problem_statement()  → problem name, description, I/O, constraints,
                                            complexity, tags  (llama-3.3-70b)
  Step 2 — generate_python_solution()    → correct Python 3 reference solution  (llama-3.1-8b)
  Step 3 — generate_cpp_solution()       → correct C++17 reference solution      (llama-3.1-8b)
  Step 4 — generate_tcgen_script()       → Python script that prints 12 test cases (llama-3.1-8b)

Rate-limit safety:
  GROQ_RPM_SLEEP seconds sleep BEFORE every call.
  Free-tier limits (llama-3.3-70b): 30 RPM / 6 000 TPM
  Free-tier limits (llama-3.1-8b):  30 RPM / 20 000 TPM
  With 5 s sleep and ≤ 1 500 tokens/call, both limits are comfortably met.
"""

import json
import logging
import re
import time
from typing import Optional

from groq import Groq, RateLimitError

from app.config import get_settings

logger = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_code_fences(text: str) -> str:
    """Remove ```python / ```cpp / ``` wrappers from an LLM code response."""
    text = text.strip()
    text = re.sub(r"^```[\w]*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    return text.strip()


def _extract_json(text: str) -> dict:
    """Extract the first valid JSON object from LLM output (handles stray markdown)."""
    text = text.strip()

    # 1) Try stripping fences first
    clean = _strip_code_fences(text)
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # 2) Locate { … } boundaries
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"No valid JSON found in LLM response. Preview: {text[:300]}")


def _call_llm(
    messages: list,
    model: str,
    max_tokens: int = 1500,
    temperature: float = 0.7,
    retries: int = 2,
) -> str:
    """
    Call Groq API with:
      • pre-call sleep to stay within RPM budget
      • retry on RateLimitError (exponential back-off)
    """
    settings = get_settings()
    time.sleep(settings.GROQ_RPM_SLEEP)          # rate-limit guard

    client = Groq(api_key=settings.GROQ_API_KEY)

    for attempt in range(retries + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content.strip()
        except RateLimitError:
            if attempt < retries:
                wait = 15 * (attempt + 1)
                logger.warning(f"Groq rate limit hit, waiting {wait}s (attempt {attempt+1})")
                time.sleep(wait)
            else:
                raise
        except Exception as e:
            if attempt < retries:
                logger.warning(f"Groq error: {e}, retrying in 5s")
                time.sleep(5)
            else:
                raise


# ── CF difficulty label ───────────────────────────────────────────────────────

def _diff_description(difficulty: int) -> str:
    if difficulty <= 1100:
        return "beginner (CF Div.3 / Div.4 A-B)"
    if difficulty <= 1400:
        return "easy-intermediate (CF Div.3 C / Div.2 B)"
    if difficulty <= 1700:
        return "intermediate (CF Div.2 C)"
    if difficulty <= 2100:
        return "advanced (CF Div.2 D / Div.1 B)"
    if difficulty <= 2500:
        return "expert (CF Div.1 C-D)"
    return "master-level (CF Div.1 D+)"


# ── Step 1: Problem Statement ─────────────────────────────────────────────────

def generate_problem_statement(
    topics: list,
    difficulty: int,
    idea: Optional[str],
) -> dict:
    """
    Generate full problem statement + metadata.

    Returns dict with keys:
        name, description, constraints, input_format, output_format,
        sample_input, sample_output, sample_explanation,
        time_limit_ms, memory_limit_mb, time_complexity, space_complexity, tags
    """
    settings = get_settings()
    topics_str = ", ".join(topics)
    idea_part = f"\n\nAdmin problem idea / hint:\n{idea}" if idea else ""
    diff_label = _diff_description(difficulty)

    prompt = f"""You are an expert Codeforces problem setter. Create a complete competitive programming problem.

Topics: {topics_str}
Difficulty: CF rating {difficulty} — {diff_label}{idea_part}

Return ONLY a single valid JSON object (no markdown fences, no explanation):
{{
  "name": "Short catchy problem title (3-7 words)",
  "description": "3-4 paragraph problem statement with clear story context and formal problem definition",
  "constraints": "One constraint per line, e.g.\\n1 ≤ t ≤ 100\\n1 ≤ n ≤ 2·10^5\\n-10^9 ≤ a_i ≤ 10^9",
  "input_format": "Detailed description of each line of input",
  "output_format": "Detailed description of what to print for each test case",
  "sample_input": "First line is t (at least 3 test cases), then inputs",
  "sample_output": "Correct outputs matching sample_input",
  "sample_explanation": "Explain each sample test case clearly",
  "time_limit_ms": 1000,
  "memory_limit_mb": 256,
  "time_complexity": "O(n log n)",
  "space_complexity": "O(n)",
  "tags": ["{topics[0] if topics else 'implementation'}"]
}}

Rules:
- Multiple test cases: first input line must be t (1 ≤ t ≤ 100)
- Problem difficulty MUST match CF rating ~{difficulty}
- Constraints and I/O must be precise and unambiguous
- JSON only — absolutely no text outside the JSON object"""

    content = _call_llm(
        [{"role": "user", "content": prompt}],
        model=settings.GROQ_MODEL_QUALITY,
        max_tokens=1800,
        temperature=0.85,
    )
    result = _extract_json(content)

    # Ensure required keys exist with sensible defaults
    result.setdefault("time_limit_ms", 1000)
    result.setdefault("memory_limit_mb", 256)
    result.setdefault("time_complexity", "O(n)")
    result.setdefault("space_complexity", "O(n)")
    result.setdefault("tags", topics[:3])
    return result


# ── Step 2: Python Reference Solution ────────────────────────────────────────

def generate_python_solution(problem_data: dict) -> str:
    """Generate correct Python 3 reference solution."""
    settings = get_settings()

    prompt = f"""Write a correct, efficient Python 3 solution for this competitive programming problem.

Problem: {problem_data['name']}
Statement: {problem_data['description'][:500]}
Constraints: {problem_data['constraints']}
Input format: {problem_data['input_format']}
Output format: {problem_data['output_format']}
Sample input:
{problem_data['sample_input']}
Sample output:
{problem_data['sample_output']}
Expected time complexity: {problem_data.get('time_complexity', 'optimal')}

Requirements:
- Read t on the first line, process t independent test cases
- Handle all edge cases implied by the constraints
- Must pass within the time limit
- Return ONLY the Python code — no markdown, no comments, no explanations"""

    code = _call_llm(
        [{"role": "user", "content": prompt}],
        model=settings.GROQ_MODEL_CODE,
        max_tokens=1200,
        temperature=0.15,
    )
    return _strip_code_fences(code)


# ── Step 3: C++ Reference Solution ───────────────────────────────────────────

def generate_cpp_solution(problem_data: dict, python_solution: str) -> str:
    """Generate correct C++17 reference solution (translated from Python)."""
    settings = get_settings()

    prompt = f"""Translate the following Python competitive programming solution to correct C++17.

Problem: {problem_data['name']}
Constraints: {problem_data['constraints']}

Python solution:
{python_solution[:900]}

Requirements:
- Add at the top: #include<bits/stdc++.h>\\nusing namespace std;
- Use fast I/O: ios::sync_with_stdio(false); cin.tie(NULL);
- Read t test cases in a loop (int t; cin >> t; while(t--) {{ ... }})
- C++17 compatible (compile with g++ -O2 -std=c++17)
- Return ONLY the C++ code — no markdown, no explanation"""

    code = _call_llm(
        [{"role": "user", "content": prompt}],
        model=settings.GROQ_MODEL_CODE,
        max_tokens=1300,
        temperature=0.15,
    )
    return _strip_code_fences(code)


# ── Step 4: Test Case Generator Script ───────────────────────────────────────

def generate_tcgen_script(problem_data: dict, python_solution: str) -> str:
    """
    Generate a Python script that outputs exactly 12 test cases separated
    by '---TC---' delimiters.

    First 2 test cases are basic/sample-like (will become public tests).
    Test cases 3-12 are diverse (edge cases, stress, common mistakes) → private tests.
    """
    settings = get_settings()

    prompt = f"""Write a Python 3 test case generator for this competitive programming problem.

Problem: {problem_data['name']}
Constraints:
{problem_data['constraints']}

Input format (CRITICAL — your output must exactly match this line-by-line):
{problem_data['input_format']}

SAMPLE INPUT (use this as the exact template for output format):
{problem_data['sample_input']}

Reference Python solution (use this to understand what your generated inputs will be fed into):
{python_solution[:700]}

━━━ TASK ━━━
The script must print EXACTLY 12 test cases.
Each test case is separated by the line "---TC---".
Start the very first output with "---TC---", then TC1, then "---TC---", TC2, etc.

Each test case block must contain t=1 (print "1" as the first line), followed by one test case
formatted EXACTLY as described in the Input format above — one value per line, same as the sample input.

CRITICAL FORMAT RULE: Study the sample_input carefully. Each test case sub-input must follow
the EXACT same line structure. For example, if the sample_input has:
  t
  n
  a_1 a_2 ... a_n
Then each test case block must be:
  1
  n
  a_1 a_2 ... a_n

WRONG: print(n, *a)      ← puts n and array on same line — NEVER do this
RIGHT: print(n); print(*a)   ← n on its own line, array on next line

Test case plan:
- TC 1: Simple case matching the first sample (easy to verify manually)
- TC 2: Another simple/readable case (different from TC 1)
- TC 3: Minimum boundary values (smallest valid input from constraints)
- TC 4: Maximum boundary values (largest possible input — stress test)
- TC 5: All-identical values edge case
- TC 6: Ascending-sorted input
- TC 7: Descending-sorted input
- TC 8: Single element / minimal n case
- TC 9: Random mixed case with seed=42
- TC 10: Classic wrong-answer trap for this problem type
- TC 11: Large random stress test (near max constraints, seed=123)
- TC 12: Another special/adversarial case

Script requirements:
- import random; random.seed(42) at the top
- No user input — entirely self-contained
- Print 12 test case blocks with "---TC---" separators
- Must complete in under 8 seconds

Return ONLY the Python script — no markdown fences, no explanation."""

    code = _call_llm(
        [{"role": "user", "content": prompt}],
        model=settings.GROQ_MODEL_CODE,
        max_tokens=1800,
        temperature=0.25,
    )
    return _strip_code_fences(code)
