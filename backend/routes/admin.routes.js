/**
 * routes/admin.routes.js
 *
 * Admin-only routes for reviewing AI-generated problems.
 *
 * Base: /api/admin
 *
 * All routes require: (1) valid JWT via requireAuth, (2) admin role via requireAdmin.
 */

const express = require('express')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const {
  getReviewQueue,
  getReviewDetail,
  publishProblem,
  rejectProblem,
} = require('../controllers/adminReview.controller')
const { getSystemHealth } = require('../controllers/systemHealth.controller')
const {
  generateProblem,
  getJobStatus,
  listJobs,
  publishAIProblem,
  rejectAIProblem,
} = require('../controllers/aiProblem.controller')
const {
  listProblems: adminListProblems,
  getProblem: adminGetProblem,
  approveProblem,
  rejectProblem: adminRejectProblem,
} = require('../controllers/adminProblem.controller')

const router = express.Router()

// Double guard: JWT auth + admin role
router.use(requireAuth, requireAdmin)

// ── Problem Review Queue ──────────────────────────────────────────────────────
// GET  /api/admin/problems/review             → paginated pending queue
// GET  /api/admin/problems/review/:id         → full detail with all 12 test cases
// POST /api/admin/problems/review/:id/publish → publish & reward user
// POST /api/admin/problems/review/:id/reject  → reject with reason
router.get('/problems/review', getReviewQueue)
router.get('/problems/review/:id', getReviewDetail)
router.post('/problems/review/:id/publish', publishProblem)
router.post('/problems/review/:id/reject', rejectProblem)

// ── System Health ─────────────────────────────────────────────────────────────
// GET /api/admin/system-health
router.get('/system-health', getSystemHealth)

// ── AI Problem Generation ─────────────────────────────────────────────────────
// POST /api/admin/ai/generate                   → queue new job
// GET  /api/admin/ai/jobs                       → list recent jobs
// GET  /api/admin/ai/jobs/:jobId                → poll job status
// POST /api/admin/ai/jobs/:jobId/publish        → approve + save to DB
// POST /api/admin/ai/jobs/:jobId/reject         → discard
router.post('/ai/generate', generateProblem)
router.get('/ai/jobs', listJobs)
router.get('/ai/jobs/:jobId', getJobStatus)
router.post('/ai/jobs/:jobId/publish', publishAIProblem)
router.post('/ai/jobs/:jobId/reject', rejectAIProblem)

// ── AI Problem Review (problems saved to DB pending approval) ─────────────────
// GET  /api/admin/ai-problems                    → list problems (all statuses)
// GET  /api/admin/ai-problems/:id                → full problem detail
// POST /api/admin/ai-problems/:id/approve        → publish
// POST /api/admin/ai-problems/:id/reject         → reject
router.get('/ai-problems', adminListProblems)
router.get('/ai-problems/:id', adminGetProblem)
router.post('/ai-problems/:id/approve', approveProblem)
router.post('/ai-problems/:id/reject', adminRejectProblem)

module.exports = router
