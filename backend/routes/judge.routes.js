/**
 * routes/judge.routes.js
 *
 * Code execution proxy routes.
 * Base: /api/judge
 */

const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const judgeController = require('../controllers/judge.controller')

// POST /api/judge/run    – run against public test cases
router.post('/run', requireAuth, judgeController.run)

// POST /api/judge/submit – submit against private test cases
router.post('/submit', requireAuth, judgeController.submit)

module.exports = router
