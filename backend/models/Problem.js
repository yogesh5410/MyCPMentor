/**
 * Problem.js
 *
 * Represents a fully reviewed and published problem on the platform.
 * Problems can originate from two sources:
 *   - 'admin'  : created directly by an admin (no coin cost, no reward)
 *   - 'user'   : created by a regular user (costs 200 coins, earns 1000 on publish)
 *
 * Test cases are stored as embedded arrays:
 *   - publicTests  : 2 visible test cases (shown to users)
 *   - privateTests : 10 hidden test cases (used during judging)
 *
 * Indices:
 *   - tags + difficulty  : filtered problem listing (O(log n) range scans)
 *   - createdBy          : "problems by user" dashboards
 *   - status             : admin review queue filter
 */

const mongoose = require('mongoose')

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    output: { type: String, required: true },
  },
  { _id: false }
)

const problemSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      // auto-generated from title in pre-save hook
    },

    // ── Statement ─────────────────────────────────────────────────────────────
    description: {
      type: String,
      required: true,
    },
    inputFormat: {
      type: String,
      default: '',
    },
    outputFormat: {
      type: String,
      default: '',
    },
    sampleInput: {
      type: String,
      default: '',
    },
    sampleOutput: {
      type: String,
      default: '',
    },
    sampleExplanation: {
      type: String,
      default: '',
    },
    constraints: {
      type: String,
      required: true,
    },

    // ── Limits ────────────────────────────────────────────────────────────────
    timeLimitMs: {
      type: Number,
      required: true,
      min: 100,
      max: 10000,
      default: 1000, // 1 second
    },
    memoryLimitMb: {
      type: Number,
      required: true,
      min: 16,
      max: 512,
      default: 256,
    },

    // ── Complexity ────────────────────────────────────────────────────────────
    optimalTimeComplexity: { type: String, required: true }, // e.g. "O(n log n)"
    optimalSpaceComplexity: { type: String, required: true }, // e.g. "O(n)"

    // ── Solution ──────────────────────────────────────────────────────────────
    solutionCpp: {
      type: String,
      required: true,
    },

    // ── Test Cases ────────────────────────────────────────────────────────────
    publicTests: {
      type: [testCaseSchema],
      validate: {
        validator: (v) => v.length >= 1 && v.length <= 2,
        message: '1–2 public test cases are required.',
      },
    },
    privateTests: {
      type: [testCaseSchema],
      validate: {
        validator: (v) => v.length >= 1 && v.length <= 10,
        message: '1–10 private test cases are required.',
      },
    },

    // ── Metadata ──────────────────────────────────────────────────────────────
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    tags: [{ type: String, trim: true }],

    // ── Provenance ────────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    creatorRole: {
      type: String,
      enum: ['user', 'admin'],
      required: true,
    },
    // AI generation job id (Redis key suffix) — set when creatorRole='admin' + AI-generated
    aiJobId: {
      type: String,
      default: null,
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    // Linked ProblemRequest (the AI generation job that produced this problem)
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProblemRequest',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending_review', 'published', 'rejected'],
      default: 'pending_review',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },

    // ── Engagement (populated after publish) ─────────────────────────────────
    totalSubmissions: { type: Number, default: 0 },
    acceptedSubmissions: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// ── Indices ───────────────────────────────────────────────────────────────────
// Compound index for "list problems by tag and difficulty" — most common query
problemSchema.index({ tags: 1, difficulty: 1 })
// For "problems created by this user"
problemSchema.index({ createdBy: 1 })
// For admin review queue: filter by status + sort by createdAt
problemSchema.index({ status: 1, createdAt: -1 })

// ── Pre-save: generate slug from title ───────────────────────────────────────
problemSchema.pre('save', async function () {
  if (this.isModified('title') || !this.slug) {
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-') +
      '-' +
      Date.now().toString(36) // suffix avoids collisions
  }
})

module.exports = mongoose.model('Problem', problemSchema)
