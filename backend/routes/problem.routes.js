/**
 * routes/problem.routes.js
 *
 * Problem browsing (public published problems) + coin wallet.
 *
 * Base: /api/problems
 */

const express = require('express')
const { requireAuth } = require('../middleware/auth')
const {
  createProblemRequest,
  getProblemRequestStatus,
  listMyProblemRequests,
  getCoinBalance,
} = require('../controllers/problemRequest.controller')
const { listPublished, getProblemBySlug } = require('../controllers/problem.controller')

const router = express.Router()

// ── Public problem browsing (requires login) ──────────────────────────────────
// GET  /api/problems        → paginated list of published problems
router.get('/', requireAuth, listPublished)

// All routes below require authentication
router.use(requireAuth)

// ── AI Problem Generation ────────────────────────────────────────────────────
router.post('/request', createProblemRequest)
router.get('/requests', listMyProblemRequests)
router.get('/request/:id', getProblemRequestStatus)

// ── Coin Wallet ───────────────────────────────────────────────────────────────
router.get('/coins', getCoinBalance)

// ── Problem detail — must be last to avoid matching static paths above ────────
// GET  /api/problems/:slug  → full problem detail (no private TCs)
router.get('/:slug', getProblemBySlug)

module.exports = router
