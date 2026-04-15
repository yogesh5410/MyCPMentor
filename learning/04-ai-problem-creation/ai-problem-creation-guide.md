# AI Problem Creation System — Complete Learning Guide

## What Is This Feature?

The **AI Problem Creation** feature allows both **users** and **admins** to describe a competitive programming problem idea in natural language (like ChatGPT) and have an AI agent generate a **complete, ready-to-judge problem** including:

- Problem title, description, and constraints
- Time and memory limits
- Optimal time/space complexity
- A working C++ solution
- 2 public test cases + 10 private test cases (actually generated and verified, not just written)
- An LLM-based quality review before the problem enters the admin queue

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Technology Choices — What, Why, How](#2-technology-choices)
3. [MongoDB Schemas — What, Why, How](#3-mongodb-schemas)
4. [Coin Economy — What, Why, How](#4-coin-economy)
5. [The RabbitMQ Queue — What, Why, How](#5-the-rabbitmq-queue)
6. [The 5-Stage Gemini Pipeline — What, Why, How](#6-the-5-stage-gemini-pipeline)
7. [Rate Limit Handling — What, Why, How](#7-rate-limit-handling)
8. [Python Test-Case Execution — What, Why, How](#8-python-test-case-execution)
9. [Admin Review Flow — What, Why, How](#9-admin-review-flow)
10. [API Reference](#10-api-reference)
11. [Security Decisions](#11-security-decisions)
12. [Data Flow Diagram](#12-data-flow-diagram)
13. [Environment Variables Reference](#13-environment-variables-reference)
14. [How to Run Locally](#14-how-to-run-locally)

---

## 1. System Architecture Overview

```
Frontend (React)
     │   POST /api/problems/request
     ▼
Node.js Backend (Express)
     │   Validates coins, deducts 200, creates ProblemRequest
     │   Publishes message to RabbitMQ
     ▼
RabbitMQ Queue: "problem_generation"
     │   Message: { requestId, userId, prompt, requesterRole }
     ▼
FastAPI AI Worker (Python)
     │   Stage 1: Generate statement (Gemini)
     │   Stage 2: Generate C++ solution (Gemini)
     │   Stage 3: Generate test-case scripts (Gemini)
     │   Stage 4: Execute scripts, get 2+10 test cases (subprocess)
     │   Stage 5: LLM review (Gemini)
     │   Creates Problem doc in MongoDB → status: pending_review
     ▼
Admin Review (Node.js)
     │   GET /api/admin/problems/review/:id  → all 12 test cases visible
     │   POST .../publish  → status: published, +1000 coins if user-created
     │   POST .../reject   → status: rejected
     ▼
MongoDB (Problem collection)
```

---

## 2. Technology Choices

### Node.js (Express) as API Gateway

**What:** All frontend requests go through Node.js first.

**Why:** Node.js already handles auth, users, and all other features. We don't want the AI service to deal with authentication, CORS, or request validation. The API gateway pattern follows the principle of separation of concerns.

**How:** The backend validates the request, deducts coins atomically, then *publishes a message* to RabbitMQ. It does NOT wait for the AI to finish — it immediately returns a `requestId` to the frontend. The frontend polls `/api/problems/request/:id` to check progress.

---

### FastAPI (Python) as AI Service

**What:** A separate microservice that runs the AI pipeline.

**Why:**
- Python has first-class Google AI SDK support (`google-generativeai`)
- Python is better for data processing and running scripts
- Separation means the AI service can be scaled independently
- If the AI service crashes, the Node.js API still works

**How:** The FastAPI service also runs a **RabbitMQ consumer (worker)** process (`worker.py`). This is not a REST API server — it's a background worker that:
  1. Connects to RabbitMQ
  2. Listens for messages
  3. Runs the pipeline for each message
  4. Updates MongoDB directly

The `main.py` just runs `uvicorn` for health checks, but the real work happens in `worker.py`.

---

### MongoDB

**What:** NoSQL document database.

**Why:** Problems have variable structure (different tags, nested test cases, different complexities). MongoDB's flexible schema handles this better than rigid SQL tables. Mongoose provides schema validation at the application layer where we need it.

**How:** We have 4 collections: `users`, `problems`, `problemrequests`, `cointransactions`.

---

### RabbitMQ

**What:** Message broker / async task queue.

**Why:**
- AI generation takes 30-120 seconds. Making the frontend wait that long on an HTTP request would timeout.
- If the server crashes during generation, the message stays in the queue (durability)
- Multiple AI workers can process jobs in parallel (horizontal scaling)
- Dead-letter queue captures permanently failed jobs for later inspection

**How:** See Section 5.

---

### Gemini 1.5 Flash (Free Tier)

**What:** Google's AI model, available free with rate limits.

**Why:**
- Free tier: 15 requests/minute, 1500 requests/day
- Flash model is fast enough for code generation
- Supports JSON output mode (`response_mime_type: "application/json"`) — critical for reliable parsing

**How:** See Section 6 and 7.

---

## 3. MongoDB Schemas

### User Schema (updated)

```javascript
{
  email, name, avatar, googleId, rating,
  role: "user" | "admin",   // NEW: access control
  coins: Number             // NEW: coin balance (denormalized for O(1) reads)
}
```

**Why coins on User?** Reading balance is very frequent (every dashboard load). Querying the CoinTransaction ledger every time would be slow. We keep a denormalized `coins` field on User and update it atomically with `$inc`. The ledger is the source of truth for auditing.

---

### Problem Schema

```javascript
{
  title, slug, description, constraints,
  timeLimitMs, memoryLimitMb,
  optimalTimeComplexity, optimalSpaceComplexity,
  solutionCpp,
  publicTests: [{ input, output }],   // 2 items, shown to users
  privateTests: [{ input, output }],  // 10 items, used by judge
  difficulty, tags,
  createdBy, creatorRole,             // who made it
  requestId,                          // link to ProblemRequest
  status: "pending_review" | "published" | "rejected",
  reviewedBy, reviewedAt, rejectionReason,
  totalSubmissions, acceptedSubmissions
}
```

**Why separate public/private tests?** Public tests are shown on the problem page so users understand the format. Private tests are only used by the judge to prevent hardcoding answers.

**Why embed test cases instead of referencing a separate collection?** Embedded is faster for reads (no JOIN/lookup). Test cases are always fetched together with the problem. Embedding is appropriate when the sub-documents are not accessed independently.

**Why a `slug`?** Slugs make URLs readable: `/problems/maximum-subarray-sum-1a2b3c` vs `/problems/64f3a1...`. Generated from title + timestamp suffix to avoid collisions.

---

### ProblemRequest Schema

```javascript
{
  requestedBy, requesterRole, prompt,
  coinsDeducted,
  status: "queued" | "processing" | "completed" | "failed",
  attempts, maxAttempts: 3,
  currentStage: "idle" | "statement" | "solution" | "test_scripts" | "test_execution" | "review" | "done",
  generations: {        // incremental pipeline output saved after each stage
    statement: { title, description, ... },
    solution: { solutionCpp },
    testCaseScripts: { publicScript, privateScript },
    testCases: { publicTests, privateTests },
    review: { passed, notes }
  },
  resultProblemId,      // set when pipeline succeeds
  errorMessage, errorStage,
  startedAt, completedAt
}
```

**Why save each stage to DB?** If the worker crashes after Stage 3, it can resume from Stage 4 without rerunning expensive API calls. This is called **checkpointing**.

**Why track `currentStage`?** The frontend can show a live progress indicator: "Generating constraints...", "Writing solution...", etc.

---

### CoinTransaction Schema (append-only ledger)

```javascript
{
  userId,
  type: "signup_bonus" | "problem_creation" | "problem_publish_reward" | "refund" | "admin_adjustment",
  amount,           // positive = credit, negative = debit
  balanceAfter,     // snapshot for fast history rendering
  referenceId,      // link to Problem or ProblemRequest
  referenceModel,
  note
}
```

**Why append-only?** Financial records must never be modified. If you need to undo a transaction, you create a new one (refund). This is the same principle used by real accounting systems.

**Why store `balanceAfter`?** You can reconstruct a user's balance at any point in time without scanning all transactions.

---

## 4. Coin Economy

| Event | Coins |
|-------|-------|
| Sign up (any method) | +500 |
| Submit AI problem request (user only) | -200 |
| AI generation fails after all retries | +200 (refund) |
| Problem published (user-created only) | +1000 |

**Why 200 cost?** Prevents spam. Each request makes 4 Gemini API calls + runs Python scripts. Without a cost, a user could overwhelm the system.

**Why 1000 reward?** Publishing a problem is a valuable contribution. The reward is 5x the cost, incentivizing quality submissions. Admins get no cost/reward — they're doing their job.

**Atomic coin deduction pattern:**
```javascript
// BAD: race condition possible
const user = await User.findById(userId)
if (user.coins >= 200) {
  user.coins -= 200
  await user.save()
}

// GOOD: atomic — deduction only happens if condition is met
const updated = await User.findOneAndUpdate(
  { _id: userId, coins: { $gte: 200 } },  // filter = the condition
  { $inc: { coins: -200 } },
  { new: true }
)
if (!updated) return "insufficient coins"
```

---

## 5. The RabbitMQ Queue

### Why a Queue Instead of a Direct HTTP Call?

If the Node.js backend called the AI service directly (HTTP), the frontend would need to wait 30-120 seconds for the response. HTTP requests timeout. The connection could drop. If the AI service is down, the request is lost.

With a queue:
1. Backend publishes message → returns immediately to frontend
2. AI worker picks up message → processes asynchronously
3. Frontend polls for status → gets progress updates

### Queue Durability

```javascript
// In Node.js (rabbitmq.js):
channel.assertQueue('problem_generation', {
  durable: true  // queue survives broker restart
})

channel.sendToQueue(queue, buffer, {
  persistent: true  // message written to disk before ack
})
```

**Why both?** `durable: true` means the queue definition survives. `persistent: true` means individual messages survive. You need BOTH for true durability.

### Dead-Letter Queue

When a job fails permanently (after 3 attempts), the message is `nack`ed without requeue, which sends it to the dead-letter queue (`problem_generation_dead`). This means:
- Failed jobs are never silently dropped
- An admin can inspect DLQ messages to debug issues
- Coins are refunded before the message is DLQ'd

### prefetch_count = 1

```python
await channel.set_qos(prefetch_count=1)
```

The worker only processes **one message at a time**. This is intentional:
- Gemini free tier is 15 RPM for the whole API key
- With `prefetch_count=1`, we never accidentally overload the API
- If you want more throughput, run multiple worker processes (each gets its own slot)

---

## 6. The 5-Stage Gemini Pipeline

### Why Multi-Stage Instead of One Big Prompt?

**Context limits:** A single prompt asking for statement + solution + 12 test cases + review would be enormous. Gemini 1.5 Flash has a 1M token limit, but very large prompts are less reliable.

**Reliability:** Smaller, focused prompts produce better results. A dedicated solution prompt can say "write optimal C++17" without mixing concerns.

**Checkpointing:** Each stage saves to DB. A crash in Stage 4 doesn't redo Stage 1-3.

**Rate limits:** 4 API calls total per job. At 15 RPM free tier, this is ~16 seconds minimum per job, which is acceptable.

---

### Stage 1: Problem Statement

**Prompt asks for:** `title, description, constraints, timeLimitMs, memoryLimitMb, optimalTimeComplexity, optimalSpaceComplexity, difficulty, tags`

**Key technique:** We use `response_mime_type: "application/json"` in the Gemini config. This forces the model to output valid JSON instead of Markdown with code blocks. Without this, we'd need to regex-parse the response, which is fragile.

---

### Stage 2: C++ Solution

**Prompt includes:** The full problem statement from Stage 1.

**Why generate solution before test cases?** The test-case generator scripts need to know the correct answer. The solution defines the expected output. This is the reference solution used to validate each generated test case.

---

### Stage 3: Test-Case Generator Scripts

**Prompt asks for:** Two Python scripts (not test cases directly).

**Why scripts instead of direct test cases?**
- Scripts can generate varied, parameterized test cases
- The same script can be re-run to get different test cases
- Scripts check their own output against constraints (if written well)
- We can run the script to *verify* the test cases will match the solution

**Script contract:**
```python
def main():
    # generate and return test cases
    return [
        {"input": "5\n1 2 3 4 5", "output": "15"},
        {"input": "1\n0", "output": "0"},
    ]
```

The `test_runner.py` wraps the script with `result = main(); print(json.dumps(result))`.

---

### Stage 4: Execute Test Scripts

**No AI here** — pure Python `subprocess`. We run both scripts and capture the JSON output.

**Sandboxing:**
- Hard timeout: 30 seconds
- Memory cap: 256MB (via `resource.setrlimit` on Linux)
- stdout captured, stderr reported in errors

---

### Stage 5: LLM Review

**Prompt includes:** Statement + solution + first 5 test cases (to manage context size).

**Checks:**
1. Is the description clear and unambiguous?
2. Is the C++ solution correct and optimal?
3. Are test cases valid according to constraints?
4. Is difficulty appropriate?

**Output:** `{ passed: bool, notes: string }`

If `passed: false`, the job fails and coins are refunded. If `passed: true`, the Problem document is created with `status: "pending_review"`.

---

## 7. Rate Limit Handling

### The Problem

Gemini free tier: **15 requests per minute, 1500 per day**.

If we make 4 calls per job and receive multiple jobs at once, we'll hit 429 errors.

### Solution 1: Per-Minute Token Bucket (in `gemini_client.py`)

```python
_rpm_window_start = 0
_rpm_calls_this_window = 0

async def _acquire_rpm_slot():
    # Track calls in 60-second windows
    # If we've made 14 calls this minute, sleep until the window resets
```

This is a **token bucket** limiter: we pre-emptively sleep before hitting the API, rather than waiting for a 429.

### Solution 2: Exponential Backoff Retry (via `tenacity`)

```python
@retry(
    retry=retry_if_exception_type(ResourceExhausted),
    wait=wait_exponential(multiplier=2, min=4, max=64),  # 4s, 8s, 16s, 32s, 64s, 64s...
    stop=stop_after_attempt(6),
)
async def _call_gemini_raw(prompt, response_mime):
    ...
```

`wait_exponential`: each retry waits twice as long. If the API is overloaded, we back off gracefully instead of hammering it.

### Solution 3: prefetch_count=1 in Worker

By only processing one job at a time per worker, we naturally cap our API call rate.

---

## 8. Python Test-Case Execution

### Why `subprocess` and Not `exec()`?

`exec()` runs code in the **same Python process**. An AI-generated infinite loop would hang the worker. A memory bomb would crash it.

`subprocess` runs code in a **separate process** that we can:
- Kill after 30 seconds (`asyncio.wait_for + proc.kill()`)
- Limit memory via `resource.setrlimit` in `preexec_fn`
- Isolate from the main process

### Why `asyncio.create_subprocess_exec`?

The worker is fully async. Using the async subprocess API means the event loop is NOT blocked while the script runs — the worker can handle signals and other tasks.

### Script Output Contract

```
AI Script → stdout: [{"input": "...", "output": "..."}]
```

We use `output.rfind("[")` and `output.rfind("]")` to extract the JSON array even if the script prints debug messages before/after the array.

---

## 9. Admin Review Flow

### Why Admin Review?

AI-generated problems may have subtle bugs:
- Off-by-one errors in constraints
- Test cases that don't match the solution
- Ambiguous problem statements
- Incorrect complexity claims

Human admin review is the final quality gate before a problem is published.

### What the Admin Sees

`GET /api/admin/problems/review/:id` returns:
- Full problem statement
- C++ solution
- **All 12 test cases** (2 public + 10 private) — not just the scripts
- The LLM review notes
- Creator info

### Publish Flow

```
Admin clicks "Publish"
  → POST /api/admin/problems/review/:id/publish
  → status: "published"
  → If creatorRole === "user": +1000 coins to creator
  → CoinTransaction record created
```

### Reject Flow

```
Admin clicks "Reject"
  → POST /api/admin/problems/review/:id/reject { reason: "..." }
  → status: "rejected"
  → rejectionReason saved
  → Note: coins are NOT refunded on rejection (only on pipeline failure)
```

---

## 10. API Reference

### Problem Creation (requires auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/problems/request` | Submit AI problem request |
| GET | `/api/problems/request/:id` | Poll generation status |
| GET | `/api/problems/requests` | List my requests (paginated) |
| GET | `/api/problems/coins` | Get coin balance + history |

**POST /api/problems/request body:**
```json
{ "prompt": "Create a problem about finding the maximum subarray sum using Kadane's algorithm" }
```

**Response:**
```json
{
  "requestId": "64f3...",
  "coinsDeducted": 200,
  "coinsRemaining": 300,
  "status": "queued"
}
```

### Admin Review (requires admin role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/problems/review` | Pending review queue |
| GET | `/api/admin/problems/review/:id` | Full problem detail |
| POST | `/api/admin/problems/review/:id/publish` | Publish problem |
| POST | `/api/admin/problems/review/:id/reject` | Reject problem |

### Internal (AI worker → Node.js)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/internal/refund` | Refund 200 coins on pipeline failure |

Protected by `x-internal-key` header (not exposed to public).

---

## 11. Security Decisions

### Atomic Coin Operations

Never read coins → modify in memory → save. Always use `$inc` with a filter:
```javascript
User.findOneAndUpdate(
  { _id: userId, coins: { $gte: 200 } },  // check + modify atomically
  { $inc: { coins: -200 } }
)
```

This is the **check-then-act** anti-pattern avoided — no race condition is possible.

### Internal API Key

The AI worker needs to call Node.js to refund coins. This endpoint (`/api/internal/refund`) is protected by a shared secret (`INTERNAL_API_KEY`). Without this check, any client could call the refund endpoint to get free coins.

### AI Code Execution Sandbox

The test-case generator scripts are AI-generated code. We run them in a subprocess with:
- Memory limit (256MB)
- Time limit (30 seconds)
- The main process is unaffected if the script crashes or hangs

### Admin Role Check in DB

The `requireAdmin` middleware fetches the role from MongoDB on every admin request, not from the JWT:
```javascript
const user = await User.findById(req.user.userId).select('role')
```
This means if an admin is demoted, their next admin request is rejected immediately (not after their 7-day token expires).

### Coin Balance `min: 0` Constraint

The User schema has `min: 0` on coins. Combined with the atomic deduction pattern, a user's balance can never go negative.

---

## 12. Data Flow Diagram

```
USER                    NODE.JS                 RABBITMQ            FASTAPI WORKER          MONGODB
 │                         │                        │                     │                    │
 │─POST /request prompt──▶ │                        │                     │                    │
 │                         │──check coins ──────────────────────────────────────────────────▶ │
 │                         │◀──coins ok ─────────────────────────────────────────────────────│
 │                         │──$inc coins -200 ──────────────────────────────────────────────▶│
 │                         │──create ProblemRequest(queued) ─────────────────────────────────▶│
 │                         │──publish msg ──────────▶│                    │                    │
 │◀───requestId ───────────│                        │                     │                    │
 │                         │                        │◀──consume ──────────│                    │
 │                         │                        │                     │──set_processing ──▶│
 │                         │                        │                     │──Stage 1 (Gemini)  │
 │                         │                        │                     │──save_statement ──▶│
 │                         │                        │                     │──Stage 2 (Gemini)  │
 │                         │                        │                     │──save_solution ───▶│
 │                         │                        │                     │──Stage 3 (Gemini)  │
 │                         │                        │                     │──save_scripts ────▶│
 │                         │                        │                     │──Stage 4 (subprocess)
 │                         │                        │                     │──save_test_cases──▶│
 │                         │                        │                     │──Stage 5 (Gemini)  │
 │                         │                        │                     │──save_review ─────▶│
 │                         │                        │                     │──create Problem ──▶│
 │                         │                        │                     │──mark_completed ──▶│
 │                         │                        │                     │──ack ─────────────▶│
 │─GET /request/:id ───────▶│                        │                     │                    │
 │                         │──find ProblemRequest ──────────────────────────────────────────▶ │
 │◀── status: completed ───│                        │                     │                    │
 │                         │                        │                     │                    │
ADMIN                      │                        │                     │                    │
 │─GET /admin/review/:id ──▶│                        │                     │                    │
 │                         │──find Problem ─────────────────────────────────────────────────▶│
 │◀── full problem + 12 TCs│                        │                     │                    │
 │─POST .../publish ───────▶│                        │                     │                    │
 │                         │──status=published, +1000 coins ────────────────────────────────▶│
 │◀── success ─────────────│                        │                     │                    │
```

---

## 13. Environment Variables Reference

### Backend (`backend/.env`)

```bash
PORT=5000
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/mycpmentor
JWT_SECRET=your_jwt_secret_here

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Email (Gmail OAuth2 via Nodemailer)
GMAIL_USER=...
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
RABBITMQ_QUEUE=problem_generation

# Internal API (shared with AI service)
INTERNAL_API_KEY=change_this_to_a_long_random_string
```

### AI Service (`ai_service/.env`)

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_RPM_LIMIT=14
GEMINI_RPD_LIMIT=1400

RABBITMQ_URL=amqp://guest:guest@localhost:5672/
RABBITMQ_QUEUE=problem_generation

MONGODB_URI=mongodb://localhost:27017/mycpmentor

BACKEND_URL=http://localhost:5000
INTERNAL_API_KEY=change_this_to_a_long_random_string
```

---

## 14. How to Run Locally

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB (local or Atlas)
- RabbitMQ (local via Docker is easiest)

### Start RabbitMQ

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management
# Management UI: http://localhost:15672 (guest/guest)
```

### Start Node.js Backend

```bash
cd backend
cp .env.example .env  # fill in your values
npm install
npm run dev
```

### Start AI Worker

```bash
cd ai_service
cp .env.example .env  # fill in your GEMINI_API_KEY
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python worker.py
```

### Test the Flow

```bash
# 1. Get a JWT (sign up / log in via the frontend or API)

# 2. Submit a problem request
curl -X POST http://localhost:5000/api/problems/request \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a problem about finding the Kth largest element in an array efficiently"}'

# Response: { "requestId": "...", "coinsDeducted": 200, ... }

# 3. Poll for status
curl http://localhost:5000/api/problems/request/YOUR_REQUEST_ID \
  -H "Authorization: Bearer YOUR_JWT"

# 4. Once status = "completed", check the admin review queue
curl http://localhost:5000/api/admin/problems/review \
  -H "Authorization: Bearer ADMIN_JWT"

# 5. Publish the problem
curl -X POST http://localhost:5000/api/admin/problems/review/PROBLEM_ID/publish \
  -H "Authorization: Bearer ADMIN_JWT"
```

---

## Key Concepts Summary

| Concept | Pattern Used | Why |
|---------|-------------|-----|
| Long-running job | Queue + polling | No HTTP timeout, works offline |
| Coin deduction | Atomic `$inc` with filter | No race conditions |
| Financial records | Append-only ledger | Auditability |
| AI prompt size | Multi-stage pipeline | Reliability + context limits |
| Rate limits | Token bucket + exponential backoff | No 429 errors |
| Script execution | Subprocess with timeout + memory limit | Isolation from AI-generated code |
| Admin gate | DB role lookup on every request | Instant demotion |
| Resumption | Stage checkpointing in DB | No wasted API calls on retry |
