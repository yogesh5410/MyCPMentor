"""
app/core/stats.py
─────────────────
Centralised Redis stats tracking for the judge service.

Redis key schema
────────────────
judge:stats:total_submissions          INT  – ever queued
judge:stats:completed                  INT  – ever finished (any verdict)
judge:stats:failed                     INT  – celery task hard-failure
judge:stats:verdict:{V}                INT  – per-verdict (AC/WA/TLE/MLE/RE/CE)
judge:stats:language:{L}               INT  – per-language (python/cpp/javascript)
judge:exec_times                       LIST – last 200 exec times (ms), newest first
judge:queue_wait_times                 LIST – last 200 queue-wait times (ms)
judge:timeline                         ZSET – member=submission_id, score=unix_ts
                                              used for rolling-window throughput queries
judge:throughput:{YYYY-MM-DDTHH:MM}    INT  – submissions completed in that minute bucket (TTL 2h)
"""

import json
import time
import logging
from typing import Optional

import redis as redis_lib

from app.config import get_settings

logger = logging.getLogger(__name__)

_EXEC_TIMES_KEY       = "judge:exec_times"
_QUEUE_WAIT_KEY       = "judge:queue_wait_times"
_TIMELINE_KEY         = "judge:timeline"
_MAX_SERIES_LEN       = 200
_TIMELINE_TTL_SECS    = 7200   # keep 2 h of timeline data


def _r() -> redis_lib.Redis:
    return redis_lib.from_url(get_settings().REDIS_URL, decode_responses=True)


# ── Submission lifecycle counters ─────────────────────────────────────────────

def record_queued(submission_id: str, language: str, enqueue_ts: Optional[float] = None) -> None:
    """Call when a submission enters the queue."""
    r = _r()
    pipe = r.pipeline()
    pipe.incr("judge:stats:total_submissions")
    pipe.incr(f"judge:stats:language:{language}")
    # Store enqueue timestamp so we can compute queue-wait when the task starts
    if enqueue_ts is None:
        enqueue_ts = time.time()
    pipe.set(f"judge:enqueue_ts:{submission_id}", enqueue_ts, ex=3600)
    pipe.execute()


def record_started(submission_id: str) -> Optional[float]:
    """
    Call at the start of the Celery task.
    Returns the queue-wait time in ms (or None if not found).
    """
    r = _r()
    enqueue_ts_raw = r.getdel(f"judge:enqueue_ts:{submission_id}")
    if enqueue_ts_raw:
        wait_ms = (time.time() - float(enqueue_ts_raw)) * 1000
        pipe = r.pipeline()
        pipe.lpush(_QUEUE_WAIT_KEY, round(wait_ms, 1))
        pipe.ltrim(_QUEUE_WAIT_KEY, 0, _MAX_SERIES_LEN - 1)
        pipe.execute()
        return wait_ms
    return None


def record_completed(
    submission_id: str,
    verdict: str,
    exec_time_ms: float,
) -> None:
    """Call after every completed judgment (any verdict, even CE)."""
    r = _r()
    now = time.time()

    # Minute bucket key (for per-minute throughput chart)
    import datetime
    minute_key = "judge:throughput:" + datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M")

    pipe = r.pipeline()
    pipe.incr("judge:stats:completed")
    pipe.incr(f"judge:stats:verdict:{verdict}")
    # Exec time rolling list
    pipe.lpush(_EXEC_TIMES_KEY, round(exec_time_ms, 1))
    pipe.ltrim(_EXEC_TIMES_KEY, 0, _MAX_SERIES_LEN - 1)
    # Timeline sorted set (score = unix timestamp)
    pipe.zadd(_TIMELINE_KEY, {submission_id: now})
    # Prune timeline older than TTL
    pipe.zremrangebyscore(_TIMELINE_KEY, 0, now - _TIMELINE_TTL_SECS)
    # Per-minute bucket (TTL = 2 h)
    pipe.incr(minute_key)
    pipe.expire(minute_key, _TIMELINE_TTL_SECS)
    pipe.execute()


def record_failed() -> None:
    _r().incr("judge:stats:failed")


# ── Aggregation helpers ───────────────────────────────────────────────────────

def get_full_stats() -> dict:
    """
    Return all telemetry for the /monitoring endpoint.
    """
    r = _r()
    now = time.time()

    # ── Basic counters ────────────────────────────────────────────────────────
    total       = int(r.get("judge:stats:total_submissions") or 0)
    completed   = int(r.get("judge:stats:completed")         or 0)
    failed      = int(r.get("judge:stats:failed")            or 0)
    in_progress = max(0, total - completed - failed)

    verdicts: dict[str, int] = {}
    for v in ("AC", "WA", "TLE", "MLE", "RE", "CE"):
        verdicts[v] = int(r.get(f"judge:stats:verdict:{v}") or 0)

    languages: dict[str, int] = {}
    for lang in ("python", "cpp", "javascript"):
        languages[lang] = int(r.get(f"judge:stats:language:{lang}") or 0)

    # ── Exec time stats ───────────────────────────────────────────────────────
    exec_raw  = r.lrange(_EXEC_TIMES_KEY, 0, -1)
    exec_vals = [float(x) for x in exec_raw]
    exec_stats = _describe(exec_vals, "exec_time_ms")

    # ── Queue wait stats ──────────────────────────────────────────────────────
    wait_raw  = r.lrange(_QUEUE_WAIT_KEY, 0, -1)
    wait_vals = [float(x) for x in wait_raw]
    wait_stats = _describe(wait_vals, "queue_wait_ms")

    # ── Rolling-window throughput ─────────────────────────────────────────────
    window_5m  = r.zcount(_TIMELINE_KEY, now - 300,  now)
    window_15m = r.zcount(_TIMELINE_KEY, now - 900,  now)
    window_1h  = r.zcount(_TIMELINE_KEY, now - 3600, now)

    # submissions per minute (average over last 5 min)
    spm_5m = round(window_5m / 5, 2)

    # ── Per-minute throughput series (last 30 buckets) ────────────────────────
    throughput_series = _get_throughput_series(r, buckets=30)

    # ── Redis info ────────────────────────────────────────────────────────────
    redis_info = _get_redis_info(r)

    # ── Acceptance rate ───────────────────────────────────────────────────────
    denom = max(completed, 1)
    ac_rate = round(verdicts.get("AC", 0) / denom * 100, 1)

    return {
        "counters": {
            "total_submissions":  total,
            "completed":          completed,
            "in_progress":        in_progress,
            "failed":             failed,
            "acceptance_rate_pct": ac_rate,
        },
        "verdicts":    verdicts,
        "languages":   languages,
        "exec_time":   exec_stats,
        "queue_wait":  wait_stats,
        "throughput": {
            "last_5m":           int(window_5m),
            "last_15m":          int(window_15m),
            "last_1h":           int(window_1h),
            "submissions_per_min_5m": spm_5m,
        },
        "throughput_series": throughput_series,
        "redis":       redis_info,
    }


def _describe(vals: list[float], prefix: str) -> dict:
    """Return min/max/avg/p50/p95/p99 for a numeric list."""
    if not vals:
        return {f"{prefix}_avg": 0, f"{prefix}_min": 0,
                f"{prefix}_max": 0, f"{prefix}_p50": 0,
                f"{prefix}_p95": 0, f"{prefix}_p99": 0,
                "sample_count": 0}
    s = sorted(vals)
    n = len(s)
    return {
        f"{prefix}_avg": round(sum(s) / n, 1),
        f"{prefix}_min": round(s[0], 1),
        f"{prefix}_max": round(s[-1], 1),
        f"{prefix}_p50": round(s[int(n * 0.50)], 1),
        f"{prefix}_p95": round(s[min(int(n * 0.95), n - 1)], 1),
        f"{prefix}_p99": round(s[min(int(n * 0.99), n - 1)], 1),
        "sample_count": n,
    }


def _get_throughput_series(r: redis_lib.Redis, buckets: int = 30) -> list[dict]:
    """
    Return the last `buckets` one-minute buckets as a list of
    {"time": "HH:MM", "submissions": N}.
    """
    import datetime
    series = []
    now_dt = datetime.datetime.utcnow()
    for i in range(buckets - 1, -1, -1):
        dt = now_dt - datetime.timedelta(minutes=i)
        key = "judge:throughput:" + dt.strftime("%Y-%m-%dT%H:%M")
        val = int(r.get(key) or 0)
        series.append({"time": dt.strftime("%H:%M"), "submissions": val})
    return series


def _get_redis_info(r: redis_lib.Redis) -> dict:
    try:
        info = r.info()
        return {
            "connected_clients": info.get("connected_clients", 0),
            "used_memory_mb":    round(info.get("used_memory", 0) / 1_048_576, 2),
            "used_memory_peak_mb": round(info.get("used_memory_peak", 0) / 1_048_576, 2),
            "uptime_days":       round(info.get("uptime_in_seconds", 0) / 86400, 1),
            "total_commands_processed": info.get("total_commands_processed", 0),
            "keyspace_hits":     info.get("keyspace_hits", 0),
            "keyspace_misses":   info.get("keyspace_misses", 0),
            "hit_rate_pct": round(
                info.get("keyspace_hits", 0) /
                max(info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1) * 100,
                1
            ),
            "role": info.get("role", "unknown"),
        }
    except Exception as exc:
        logger.warning("Redis info probe failed: %s", exc)
        return {}
