from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from enum import Enum


class Language(str, Enum):
    python = "python"
    cpp = "cpp"
    javascript = "javascript"


class TestCase(BaseModel):
    input: str
    expected_output: str
    is_hidden: bool = False


class SubmissionRequest(BaseModel):
    submission_id: str
    user_id: str
    problem_id: str
    code: str
    language: Language
    test_cases: List[TestCase]
    time_limit: int = Field(default=5, ge=1, le=10)
    memory_limit: int = Field(default=256, ge=32, le=512)

    @field_validator("code")
    @classmethod
    def code_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Code must not be empty")
        return v

    @field_validator("test_cases")
    @classmethod
    def at_least_one_test(cls, v: list) -> list:
        if not v:
            raise ValueError("At least one test case is required")
        return v


class TestCaseResult(BaseModel):
    test_case_index: int
    verdict: str
    time_ms: Optional[float] = None
    memory_mb: Optional[float] = None
    # Only populated for visible (non-hidden) test cases
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    expected: Optional[str] = None


class JudgeResult(BaseModel):
    submission_id: str
    verdict: str          # AC | WA | TLE | MLE | RE | CE
    total_tests: int
    passed_tests: int
    time_ms: Optional[float] = None
    memory_mb: Optional[float] = None
    compile_error: Optional[str] = None
    test_results: List[TestCaseResult] = []
    status: str = "completed"


class SubmitResponse(BaseModel):
    submission_id: str
    status: str           # pending | processing | completed | failed


class StatusResponse(BaseModel):
    submission_id: str
    status: str
    result: Optional[JudgeResult] = None
