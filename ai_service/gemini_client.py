"""
ai_service/gemini_client.py

Wraps the Google Generative AI SDK with:
  - Rate-limit awareness: token-bucket-style per-minute limiter
  - Exponential-backoff retry on 429 (ResourceExhausted) errors
  - Structured JSON output enforcement via response_mime_type
  - Context-size safety: input is truncated if it would exceed ~800k tokens
    (Gemini 1.5 Flash supports 1M tokens, but we keep 200k spare for the response)

Design note:
  The free-tier limit is 15 RPM.  We use tenacity to retry with exponential
  backoff capped at 64 seconds.  Combined with the per-minute token bucket this
  means we never hammer the API — we gracefully slow down.
"""

import asyncio
import json
import time
import logging
from typing import Any

import google.generativeai as genai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)
from google.api_core.exceptions import ResourceExhausted, InternalServerError

from config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_RPM_LIMIT

logger = logging.getLogger(__name__)

# ── Configure SDK ─────────────────────────────────────────────────────────────
genai.configure(api_key=GEMINI_API_KEY)

# ── Per-minute rate limiter ───────────────────────────────────────────────────
# Simple token bucket: refills every 60 seconds.
_rpm_lock = asyncio.Lock()
_rpm_window_start: float = 0.0
_rpm_calls_this_window: int = 0


async def _acquire_rpm_slot() -> None:
    """Block until a request slot is available within the current RPM window."""
    global _rpm_window_start, _rpm_calls_this_window

    async with _rpm_lock:
        now = time.monotonic()
        window_elapsed = now - _rpm_window_start

        if window_elapsed >= 60.0:
            # New window
            _rpm_window_start = now
            _rpm_calls_this_window = 0

        if _rpm_calls_this_window >= GEMINI_RPM_LIMIT:
            # Wait until the current window expires
            sleep_for = 60.0 - window_elapsed + 0.5  # 0.5s buffer
            logger.info(f"[Gemini] RPM limit reached. Sleeping {sleep_for:.1f}s...")
            await asyncio.sleep(sleep_for)
            _rpm_window_start = time.monotonic()
            _rpm_calls_this_window = 0

        _rpm_calls_this_window += 1


# ── Model factory ─────────────────────────────────────────────────────────────

def _make_model(response_mime: str = "application/json") -> genai.GenerativeModel:
    return genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config=genai.GenerationConfig(
            temperature=0.7,
            response_mime_type=response_mime,
            max_output_tokens=8192,
        ),
    )


# ── Core call with retry ──────────────────────────────────────────────────────

@retry(
    retry=retry_if_exception_type((ResourceExhausted, InternalServerError)),
    wait=wait_exponential(multiplier=2, min=4, max=64),
    stop=stop_after_attempt(6),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def _call_gemini_raw(prompt: str, response_mime: str) -> str:
    """Low-level Gemini call.  Handles rate-limit retry via tenacity."""
    await _acquire_rpm_slot()
    model = _make_model(response_mime)
    # Run in executor so the sync SDK doesn't block the event loop
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(None, model.generate_content, prompt)
    return response.text


# ── Public helpers ────────────────────────────────────────────────────────────

MAX_PROMPT_CHARS = 800_000  # ~200k tokens of headroom below 1M limit


def _truncate_prompt(prompt: str) -> str:
    if len(prompt) > MAX_PROMPT_CHARS:
        logger.warning(f"[Gemini] Prompt truncated from {len(prompt)} to {MAX_PROMPT_CHARS} chars")
        return prompt[:MAX_PROMPT_CHARS]
    return prompt


async def call_gemini_json(prompt: str) -> Any:
    """
    Call Gemini and parse the response as JSON.
    Returns the parsed Python object.
    Raises ValueError if the response is not valid JSON.
    """
    safe_prompt = _truncate_prompt(prompt)
    raw = await _call_gemini_raw(safe_prompt, response_mime="application/json")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"[Gemini] JSON parse error: {e}\nRaw response (first 500 chars):\n{raw[:500]}")
        raise ValueError(f"Gemini returned non-JSON output: {e}") from e


async def call_gemini_text(prompt: str) -> str:
    """
    Call Gemini and return plain text response.
    Used for the review stage where we want a readable report.
    """
    safe_prompt = _truncate_prompt(prompt)
    return await _call_gemini_raw(safe_prompt, response_mime="text/plain")
