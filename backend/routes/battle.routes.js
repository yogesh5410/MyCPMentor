/**
 * routes/battle.routes.js
 * Base: /api/battles
 */

const express  = require('express')
const router   = express.Router()
const { requireAuth } = require('../middleware/auth')
const battleController = require('../controllers/battle.controller')

router.get('/stats',   requireAuth, battleController.getStats)
router.get('/history', requireAuth, battleController.getHistory)

module.exports = router
