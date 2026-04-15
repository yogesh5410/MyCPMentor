# System Architecture Overview — MyCPMentor

## Why This Matters
System design is the most impactful interview topic for senior/mid-level roles.
This doc covers the full architecture we're building and the key decisions behind it.

---

## 1. High-Level Architecture

```
Browser / Mobile
      │
      ▼
  Next.js Frontend
      │
      ▼
  API Gateway (Node.js)          ← Single entry point
  ├── Auth Service
  ├── User Service
  ├── Problem Service
  ├── Submission Service
  ├── AI Mentor Service
  ├── Analytics Service
  └── Battle Service
      │
      ▼
  Message Broker (RabbitMQ)      ← Async job queue
      │
      ▼
  Worker Processes               ← Execution engine, AI jobs
      │
      ├── MongoDB                ← Primary database
      ├── Redis                  ← Cache, sessions, pub/sub, leaderboards
      └── Docker sandbox         ← Code execution isolation
```

---

## 2. Why Microservices?

**Monolith** (one codebase, one deploy): Simple to start, but:
- A surge in submission traffic could crash the whole app (including auth)
- Different services need different scaling (code execution is CPU-heavy, auth is lightweight)
- Hard to deploy one feature independently

**Microservices** (separate services):
- Scale each service independently (run 10 execution workers, 2 auth instances)
- Services can use different tech stacks if needed
- Failure isolation — if AI Mentor goes down, battles still work

**API Gateway Pattern**: All client requests go through one entry point that routes to services.
Benefits: single place for auth validation, rate limiting, logging, request shaping.

---

## 3. Why MongoDB?

- **Flexible schema**: Problems, submissions, users all have varied shapes (different languages,
  different test case formats, different analytics metadata)
- **Document model**: A submission document naturally contains nested test case results
- **Horizontal scaling**: Sharding built in — important when we have millions of submissions
- **Atlas Search**: Full-text search on problems without a separate search service

---

## 4. Why Redis?

Redis is an in-memory key-value store. We use it for 5 distinct use cases:

| Use Case | Why Redis |
|----------|-----------|
| **Caching** | MongoDB reads are disk-based. Cache hot problems/user profiles in memory (< 1ms) |
| **Sessions** | Store user sessions. Fast read on every authenticated request |
| **Rate Limiting** | Token bucket counters — atomic increment with TTL |
| **Pub/Sub** | Push real-time battle updates to clients (server → browser) |
| **Leaderboards** | Sorted Sets (`ZADD`, `ZRANK`) — perfect data structure for rankings |

---

## 5. Why RabbitMQ?

Code execution is:
- **Slow** (might take 1-5 seconds)
- **Resource-heavy** (CPU, memory per Docker container)
- **Spiky** (100 submits in 1 second during a contest)

If we handle submissions synchronously (HTTP request → execute → respond), the server blocks.

**Solution — Message Queue**:
```
Client submits code  →  API adds job to queue  →  respond "queued" immediately
                                                        ↓
                                            Worker picks up job from queue
                                                        ↓
                                            Docker executes code
                                                        ↓
                                            Result stored + client notified (WebSocket/polling)
```

Benefits:
- API stays responsive regardless of execution load
- Add more workers (horizontal scale) when queue backs up
- Dead Letter Queue (DLQ): failed jobs go here for inspection/retry
- Retry logic: re-queue failed jobs with back-off

---

## 6. Event-Driven Architecture

```
Submission completed
      │
      ├── → Analytics Service  (update stats, heatmaps)
      ├── → AI Mentor Service  (re-evaluate weak topics)
      └── → Revision Service  (schedule problem for review)
```

Services communicate by **events** (messages), not direct HTTP calls.
Each service subscribes to events it cares about.

**Why this is better than direct calls**:
- Analytics going down doesn't break submissions
- Services are decoupled — you can add a new subscriber without changing the producer
- Better performance (async)

This pattern is called **Event-Driven Architecture** or **Pub/Sub**.

---

## 7. Execution Engine Design

```
Submit → RabbitMQ Queue → Worker
                              │
                    Pull Docker image (python:3.11, gcc:latest etc.)
                              │
                    Create container with:
                      - memory limit (256MB)
                      - CPU limit
                      - timeout (2s)
                      - network disabled
                      - read-only filesystem
                              │
                    Run code against each test case
                              │
                    Compare output → Verdict (AC / WA / TLE / MLE / RE)
                              │
                    Store result in MongoDB
                              │
                    Publish "submission_completed" event
```

**Security considerations**:
- Network disabled — code can't make external HTTP calls
- Filesystem read-only — code can't delete system files
- PID namespace isolation — can't see or kill other processes
- Memory/CPU hard limits — prevents resource exhaustion DoS

---

## 8. CQRS Pattern

**CQRS = Command Query Responsibility Segregation**

**Command** (write): Submit code, create battle, add problem to sheet
**Query** (read): View analytics dashboard, view leaderboard, view problem list

We separate these because:
- Reads are 10x more frequent than writes
- Reads can be served from Redis cache (denormalized, fast)
- Writes need strong consistency + validation

```
Write path: API → Validation → MongoDB write → Publish event
Read path:  API → Redis cache → (cache miss) → MongoDB read → Cache it
```

---

## 9. Key Interview Questions

**Q: How would you handle a sudden 10× spike in submissions?**
The queue (RabbitMQ) absorbs the spike. Workers process at their own pace. We auto-scale workers
(Kubernetes HPA or ECS auto-scaling) based on queue depth metric.

**Q: How do you prevent a user from submitting malicious code?**
1. Docker isolation (network off, read-only FS, resource limits)
2. Rate limiting on the submission API (token bucket in Redis)
3. Timeout kills the container after N seconds
4. Run as non-root user inside container

**Q: Why not just use a database for rate limiting?**
Database writes are disk-based (~5ms). For rate limiting you need sub-millisecond atomic counters.
Redis INCR + EXPIRE is atomic and executes in memory (<1ms). Perfect for this use case.

**Q: What is a Dead Letter Queue?**
A separate queue where messages go when they fail processing after max retries.
Lets you inspect failed jobs, debug them, and replay them without losing data.
