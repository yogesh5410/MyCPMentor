/**
 * routes/internal.routes.js
 *
 * Internal-only routes called by the AI worker service (FastAPI).
 * Protected by a shared secret (INTERNAL_API_KEY) — NOT exposed to the public.
 *
 * Base: /api/internal
 */

const express = require('express')
const router = express.Router()
const User = require('../models/User')
const ProblemRequest = require('../models/ProblemRequest')
const CoinTransaction = require('../models/CoinTransaction')

// ── Internal auth middleware ──────────────────────────────────────────────────
const requireInternalKey = (req, res, next) => {
  const key = req.headers['x-internal-key']
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}

// ── POST /api/internal/refund ─────────────────────────────────────────────────
// Called by AI worker when a generation job fails after exhausting retries.
// Refunds 200 coins to the user.
router.post('/refund', requireInternalKey, async (req, res) => {
  const { requestId, userId } = req.body

  if (!requestId || !userId) {
    return res.status(400).json({ error: 'requestId and userId are required.' })
  }

  const request = await ProblemRequest.findById(requestId).select('coinsDeducted status').lean()
  if (!request) return res.status(404).json({ error: 'Request not found.' })
  if (request.coinsDeducted === 0) {
    return res.json({ message: 'No coins to refund (admin request).' })
  }

  // Check if already refunded (idempotency: don't double-refund)
  const existingRefund = await CoinTransaction.findOne({
    referenceId: request._id,
    type: 'refund',
  }).lean()

  if (existingRefund) {
    return res.json({ message: 'Already refunded.' })
  }

  const REFUND_AMOUNT = request.coinsDeducted
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { coins: REFUND_AMOUNT } },
    { new: true, select: 'coins' }
  )

  if (!updated) return res.status(404).json({ error: 'User not found.' })

  await CoinTransaction.create({
    userId,
    type: 'refund',
    amount: REFUND_AMOUNT,
    balanceAfter: updated.coins,
    referenceId: request._id,
    referenceModel: 'ProblemRequest',
    note: 'Refund: AI generation pipeline failed',
  })

  res.json({ message: 'Coins refunded.', amount: REFUND_AMOUNT, newBalance: updated.coins })
})

module.exports = router
