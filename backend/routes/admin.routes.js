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

module.exports = router
