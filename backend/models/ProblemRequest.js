/**
 * ProblemRequest.js
 *
 * Tracks the full lifecycle of an AI problem-generation job.
 *
 * Flow:
 *   User/Admin submits idea  →  status: 'queued'
 *   RabbitMQ worker picks up →  status: 'processing'
 *   AI pipeline succeeds     →  status: 'completed'  (Problem doc created)
 *   AI pipeline fails        →  status: 'failed'     (error logged, coins refunded)
 *
 * The `generations` subdocument stores each stage of the multi-step AI pipeline
 * so that partial results are never lost and can be replayed on retry.
 *
 * Indices:
 *   - requestedBy + status : "my requests" dashboard
 *   - status + createdAt   : worker queue polling (compound, sparse)
 */

const mongoose = require('mongoose')

const generationStagesSchema = new mongoose.Schema(
  {
    // Stage 1 — problem statement
    statement: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      constraints: { type: String, default: '' },
      timeLimitMs: { type: Number, default: null },
      memoryLimitMb: { type: Number, default: null },
      optimalTimeComplexity: { type: String, default: '' },
      optimalSpaceComplexity: { type: String, default: '' },
      difficulty: { type: String, default: '' },
      tags: [{ type: String }],
    },
    // Stage 2 — C++ solution
    solution: {
      solutionCpp: { type: String, default: '' },
    },
    // Stage 3 — Python test-case generator scripts
    testCaseScripts: {
      publicScript: { type: String, default: '' },   // generates 2 public test cases
      privateScript: { type: String, default: '' },  // generates 10 private test cases
    },
    // Stage 4 — actual test cases (produced by running the scripts)
    testCases: {
      publicTests: { type: Array, default: [] },
      privateTests: { type: Array, default: [] },
    },
    // Stage 5 — final LLM review report
    review: {
      passed: { type: Boolean, default: null },
      notes: { type: String, default: '' },
    },
  },
  { _id: false }
)

const problemRequestSchema = new mongoose.Schema(
  {
    // ── Who and What ──────────────────────────────────────────────────────────
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requesterRole: {
      type: String,
      enum: ['user', 'admin'],
      required: true,
    },
    // Original user prompt (the "ChatGPT-like" idea description)
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    // ── Coins ─────────────────────────────────────────────────────────────────
    // 200 coins deducted at request creation (for user role).
    // Refunded on 'failed', rewarded 1000 on 'published'.
    coinsDeducted: { type: Number, default: 0 },

    // ── Queue / Worker ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
    },
    // RabbitMQ delivery tag — stored so we can ack/nack from outside the consumer
    rabbitDeliveryTag: { type: Number, default: null },
    // Number of times this job has been attempted (for retry logic)
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },

    // Pipeline stage currently executing (for monitoring dashboard)
    currentStage: {
      type: String,
      enum: ['idle', 'statement', 'solution', 'test_scripts', 'test_execution', 'review', 'done'],
      default: 'idle',
    },

    // ── AI Pipeline Data ──────────────────────────────────────────────────────
    generations: {
      type: generationStagesSchema,
      default: () => ({}),
    },

    // ── Output ────────────────────────────────────────────────────────────────
    // Set when AI pipeline completes and the Problem doc is created
    resultProblemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      default: null,
    },

    // Error details if job failed
    errorMessage: { type: String, default: '' },
    errorStage: { type: String, default: '' }, // which stage failed

    // ── Timestamps ────────────────────────────────────────────────────────────
    startedAt: { type: Date, default: null },   // when worker picked it up
    completedAt: { type: Date, default: null }, // when pipeline finished
  },
  { timestamps: true }
)

// ── Indices ───────────────────────────────────────────────────────────────────
problemRequestSchema.index({ requestedBy: 1, status: 1, createdAt: -1 })
// Worker polling: pop oldest queued jobs first
problemRequestSchema.index({ status: 1, createdAt: 1 })

module.exports = mongoose.model('ProblemRequest', problemRequestSchema)
