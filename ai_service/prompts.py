"""
ai_service/prompts.py

All Gemini prompt templates used in the 5-stage problem generation pipeline.

Why separate prompts into a file?
  - Easy to iterate and improve prompts without touching pipeline logic
  - Can be swapped per model (Flash vs Pro) without code changes
  - Clear contract: each prompt specifies the EXACT JSON schema Gemini must return

Stage overview:
  1. generate_statement  → problem title, description, constraints, limits, complexity, tags
  2. generate_solution   → C++ solution
  3. generate_test_scripts → Python scripts (one for 2 public + one for 10 private test cases)
  4. [test_runner.py executes the scripts]
  5. review_problem      → LLM validates everything is consistent and correct
"""


def prompt_generate_statement(user_prompt: str) -> str:
    return f"""You are an expert competitive programming problem setter.

A user/admin wants to create a competitive programming problem with this idea:
\"\"\"
{user_prompt}
\"\"\"

Generate a complete, well-structured problem statement. Output ONLY valid JSON matching EXACTLY this schema (no extra keys, no markdown):

{{
  "title": "string (max 100 chars, creative name)",
  "description": "string (full problem statement in markdown; include examples section with 2 sample input/output blocks)",
  "constraints": "string (e.g. '1 ≤ n ≤ 10^5, 1 ≤ a[i] ≤ 10^9')",
  "timeLimitMs": integer (100 to 5000),
  "memoryLimitMb": integer (16 to 512),
  "optimalTimeComplexity": "string (e.g. 'O(n log n)')",
  "optimalSpaceComplexity": "string (e.g. 'O(n)')",
  "difficulty": "easy" | "medium" | "hard",
  "tags": ["string", ...]
}}

Rules:
- The description must be clear, unambiguous, and solvable.
- Include at least 2 worked examples in the description.
- Tags must be valid CP topics (e.g. "dp", "greedy", "graphs", "binary search", etc).
- Constraints must be consistent with the time/memory limits and optimal complexity.
"""


def prompt_generate_solution(statement_json: dict) -> str:
    import json
    return f"""You are an expert competitive programmer.

Here is a competitive programming problem:
Title: {statement_json['title']}
Description:
{statement_json['description']}

Constraints: {statement_json['constraints']}
Time Limit: {statement_json['timeLimitMs']}ms
Memory Limit: {statement_json['memoryLimitMb']}MB
Optimal Time Complexity: {statement_json['optimalTimeComplexity']}
Optimal Space Complexity: {statement_json['optimalSpaceComplexity']}

Write a complete, correct, and optimally efficient C++ solution.
Output ONLY valid JSON matching EXACTLY this schema (no extra keys, no markdown):

{{
  "solutionCpp": "string (complete C++17 code, including all headers and main function)"
}}

Rules:
- The code must compile with: g++ -O2 -std=c++17 -o sol sol.cpp
- Must read from stdin and write to stdout.
- Must handle all edge cases described in the constraints.
- Optimal complexity: {statement_json['optimalTimeComplexity']} time, {statement_json['optimalSpaceComplexity']} space.
- Do NOT include test cases or explanations in the code — only the solution.
"""


def prompt_generate_test_scripts(statement_json: dict, solution_cpp: str) -> str:
    return f"""You are an expert competitive programmer and test-case engineer.

Problem:
Title: {statement_json['title']}
Description:
{statement_json['description']}
Constraints: {statement_json['constraints']}

C++ reference solution:
```cpp
{solution_cpp[:3000]}
```
(solution truncated to 3000 chars if longer)

Write TWO Python scripts to generate test cases for this problem.

IMPORTANT: Each script must define a function called `main()` that RETURNS a Python list of dicts.
Each dict must have exactly two string keys: "input" and "output".

Script 1 (public) must return EXACTLY 2 test cases.
Script 2 (private) must return EXACTLY 10 test cases — varied edge cases, stress tests, and corner cases.

Output ONLY valid JSON matching EXACTLY this schema:

{{
  "publicScript": "string (complete Python script with a main() function that returns a list of 2 dicts)",
  "privateScript": "string (complete Python script with a main() function that returns a list of 10 dicts)"
}}

Rules for the scripts:
- Each script must be self-contained (no external libraries beyond Python stdlib).
- The main() function must RETURN the list (not print it — the runner will handle printing).
- Test cases must respect ALL constraints in the problem.
- Private test cases must cover: minimum values, maximum values, edge cases, stress tests.
- Output values must be correct answers according to the reference solution logic.
- Use only random, itertools, math, collections from stdlib if needed.
"""


def prompt_review_problem(
    statement_json: dict,
    solution_cpp: str,
    public_tests: list,
    private_tests: list,
) -> str:
    import json
    all_tests = public_tests + private_tests
    # Show first 5 test cases in the review prompt to manage context size
    sample_tests = all_tests[:5]
    return f"""You are a senior competitive programming judge. Review the following AI-generated problem for correctness and quality.

=== PROBLEM STATEMENT ===
Title: {statement_json['title']}
Description:
{statement_json['description']}
Constraints: {statement_json['constraints']}
Time Limit: {statement_json['timeLimitMs']}ms | Memory Limit: {statement_json['memoryLimitMb']}MB
Optimal Complexity: {statement_json['optimalTimeComplexity']} time, {statement_json['optimalSpaceComplexity']} space
Difficulty: {statement_json['difficulty']}

=== C++ SOLUTION ===
```cpp
{solution_cpp[:3000]}
```

=== SAMPLE TEST CASES (first 5 of 12) ===
{json.dumps(sample_tests, indent=2)[:2000]}

Review and output ONLY valid JSON matching EXACTLY this schema:

{{
  "passed": true | false,
  "notes": "string (detailed review notes — list any issues found; if passed=true, confirm why it's good)"
}}

Check:
1. Is the problem description clear and unambiguous?
2. Is the C++ solution correct and of optimal complexity?
3. Are the test cases valid according to the constraints?
4. Do the sample test-case inputs/outputs appear to match the solution logic?
5. Are constraints realistic for the given time/memory limits?
6. Is the difficulty tag appropriate?

If ANY major issue is found, set passed=false and explain in notes.
"""
