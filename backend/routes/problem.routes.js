/**
 * routes/problem.routes.js
 *
 * All routes for AI problem-creation requests and coin wallet.
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

const router = express.Router()

// All routes require authentication
router.use(requireAuth)

// ── AI Problem Generation ────────────────────────────────────────────────────
// POST   /api/problems/request       → submit a new AI problem request
// GET    /api/problems/requests      → list current user's requests
// GET    /api/problems/request/:id   → poll status of a specific request
router.post('/request', createProblemRequest)
router.get('/requests', listMyProblemRequests)
router.get('/request/:id', getProblemRequestStatus)

// ── Coin Wallet ───────────────────────────────────────────────────────────────
// GET    /api/problems/coins         → get balance + recent transaction history
router.get('/coins', getCoinBalance)

module.exports = router
