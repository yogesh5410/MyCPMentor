"""
Pydantic v2 models for the AI Problem Generation Service.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Inbound ───────────────────────────────────────────────────────────────────

class GenerationRequest(BaseModel):
    """Admin submits this to queue a new problem generation job."""
    topics: List[str] = Field(..., min_length=1, max_length=5,
                               description="1-5 topic tags, e.g. ['graphs', 'BFS']")
    difficulty: int = Field(default=1400, ge=800, le=3500,
                            description="CF rating difficulty target (800-3500)")
    idea: Optional[str] = Field(default=None, max_length=600,
                                 description="Optional admin hint / problem idea")


# ── Test-case data ────────────────────────────────────────────────────────────

class TestCaseData(BaseModel):
    input: str
    expected_output: str
    is_hidden: bool = False


# ── Job state (stored in Redis as JSON) ──────────────────────────────────────

class JobStatus(BaseModel):
    job_id: str
    status: str = "queued"
    progress: int = 0          # 0-100
    current_step: str = "Queued for generation"
    error: Optional[str] = None

    # Generation config (echoed back)
    topics: List[str] = []
    difficulty: int = 1400
    idea: Optional[str] = None

    # --- Generated fields (filled as pipeline progresses) ---
    name: Optional[str] = None
    description: Optional[str] = None
    constraints: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    sample_input: Optional[str] = None
    sample_output: Optional[str] = None
    sample_explanation: Optional[str] = None
    time_limit_ms: int = 1000
    memory_limit_mb: int = 256
    time_complexity: Optional[str] = None
    space_complexity: Optional[str] = None
    tags: List[str] = []

    solution_language: str = "python"
    solution_code: Optional[str] = None
    solution_cpp: Optional[str] = None

    tcgen_script: Optional[str] = None
    test_cases: List[TestCaseData] = []

    validation_passed: Optional[bool] = None
    validation_notes: Optional[str] = None

    created_at: str = ""
    completed_at: Optional[str] = None


# ── Outbound ──────────────────────────────────────────────────────────────────

class EnqueueResponse(BaseModel):
    job_id: str
    status: str
    created_at: str
