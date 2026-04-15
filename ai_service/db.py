"""
ai_service/db.py

Async MongoDB adapter for updating ProblemRequest stage data and creating
the final Problem document after a successful pipeline run.

Uses motor (async MongoDB driver) with optimized projection + update queries.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import motor.motor_asyncio
from bson import ObjectId

from config import MONGODB_URI

logger = logging.getLogger(__name__)

_client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
_db = None


def get_db():
    global _client, _db
    if _db is None:
        _client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
        _db = _client.get_default_database()
    return _db


# ── ProblemRequest operations ─────────────────────────────────────────────────

async def get_request(request_id: str) -> Optional[Dict]:
    db = get_db()
    return await db.problemrequests.find_one(
        {"_id": ObjectId(request_id)},
        {"generations": 1, "status": 1, "requestedBy": 1, "requesterRole": 1, "coinsDeducted": 1},
    )


async def set_processing(request_id: str) -> None:
    db = get_db()
    await db.problemrequests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": "processing",
                "startedAt": datetime.now(timezone.utc),
                "currentStage": "idle",
            },
            "$inc": {"attempts": 1},
        },
    )


async def update_stage(request_id: str, stage: str) -> None:
    db = get_db()
    await db.problemrequests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"currentStage": stage}},
    )


async def save_statement(request_id: str, data: Dict) -> None:
    db = get_db()
    await db.problemrequests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"generations.statement": data}},
    )


async def save_solution(request_id: str, solution_cpp: str) -> None:
    db = get_db()
    await db.problemrequests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"generations.solution.solutionCpp": solution_cpp}},
    )


async def save_test_scripts(request_id: str, public_script: str, private_script: str) -> None:
    db = get_db()
    await db.problemrequests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "generations.testCaseScripts.publicScript": public_script,
                "generations.testCaseScripts.privateScript": private_script,
            }
        },
    )


async def save_test_cases(
    request_id: str, public_tests: List[Dict], private_tests: List[Dict]
) -> None:
    db = get_db()
    await db.problemrequests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "generations.testCases.publicTests": public_tests,
                "generations.testCases.privateTests": private_tests,
            }
        },
    )


async def save_review(request_id: str, passed: bool, notes: str) -> None:
    db = get_db()
    await db.problemrequests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "generations.review.passed": passed,
                "generations.review.notes": notes,
            }
        },
    )


async def mark_failed(request_id: str, error_message: str, error_stage: str) -> None:
    db = get_db()
    await db.problemrequests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": "failed",
                "errorMessage": error_message,
                "errorStage": error_stage,
                "completedAt": datetime.now(timezone.utc),
                "currentStage": "idle",
            }
        },
    )


async def mark_completed(request_id: str, problem_id: str) -> None:
    db = get_db()
    await db.problemrequests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": "completed",
                "resultProblemId": ObjectId(problem_id),
                "completedAt": datetime.now(timezone.utc),
                "currentStage": "done",
            }
        },
    )


# ── Problem creation ──────────────────────────────────────────────────────────

async def create_problem(
    request_id: str,
    requester_id: str,
    requester_role: str,
    result: Dict[str, Any],
) -> str:
    """
    Creates the Problem document from pipeline output.
    Returns the new problem's _id as a string.
    """
    db = get_db()
    stmt = result["statement"]

    # Generate slug
    import re, time
    slug = re.sub(r"[^a-z0-9\s-]", "", stmt["title"].lower()).strip()
    slug = re.sub(r"\s+", "-", slug) + "-" + format(int(time.time()), "x")

    problem_doc = {
        "title": stmt["title"],
        "slug": slug,
        "description": stmt["description"],
        "constraints": stmt["constraints"],
        "timeLimitMs": int(stmt["timeLimitMs"]),
        "memoryLimitMb": int(stmt["memoryLimitMb"]),
        "optimalTimeComplexity": stmt["optimalTimeComplexity"],
        "optimalSpaceComplexity": stmt["optimalSpaceComplexity"],
        "difficulty": stmt.get("difficulty", "medium"),
        "tags": stmt.get("tags", []),
        "solutionCpp": result["solutionCpp"],
        "publicTests": result["publicTests"],
        "privateTests": result["privateTests"],
        "createdBy": ObjectId(requester_id),
        "creatorRole": requester_role,
        "requestId": ObjectId(request_id),
        "status": "pending_review",
        "reviewedBy": None,
        "reviewedAt": None,
        "rejectionReason": "",
        "totalSubmissions": 0,
        "acceptedSubmissions": 0,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    inserted = await db.problems.insert_one(problem_doc)
    logger.info(f"[DB] Created Problem {inserted.inserted_id} from request {request_id}")
    return str(inserted.inserted_id)
