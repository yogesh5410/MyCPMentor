/**
 * controllers/problemRequest.controller.js
 *
 * Handles the "create problem via AI" flow:
 *
 *   POST /api/problems/request
 *     - Validate coins (user needs 200)
 *     - Atomically deduct 200 coins
 *     - Create ProblemRequest doc (status: 'queued')
 *     - Publish job to RabbitMQ
 *     - Return request ID to client (for polling)
 *
 *   GET /api/problems/request/:id
 *     - Poll the status of a generation job
 *
 *   GET /api/problems/requests
 *     - List the current user's requests (paginated)
 *
 *   GET /api/problems/coins
 *     - Get the current user's coin balance + recent history
 */

const User = require('../models/User')
const ProblemRequest = require('../models/ProblemRequest')
const CoinTransaction = require('../models/CoinTransaction')
const { publishProblemRequest } = require('../config/rabbitmq')

const PROBLEM_CREATION_COST = 200

// ─── POST /api/problems/request ──────────────────────────────────────────────
const createProblemRequest = async (req, res) => {
  const { prompt } = req.body

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 20) {
    return res.status(400).json({
      error: 'Please provide a detailed problem description (at least 20 characters).',
    })
  }
  if (prompt.trim().length > 5000) {
    return res.status(400).json({ error: 'Description must be 5000 characters or fewer.' })
  }

  const userId = req.user.userId

  // ── Coin deduction (atomic) ──────────────────────────────────────────────
  // Use findOneAndUpdate with a $gte filter so the deduction only happens
  // when the user actually has enough coins — no read-then-write race.
  let updatedUser = null
  let coinsDeducted = 0

  if (req.user.role !== 'admin') {
    updatedUser = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: PROBLEM_CREATION_COST } },
      { $inc: { coins: -PROBLEM_CREATION_COST } },
      { new: true, select: 'coins role' }
    )
    if (!updatedUser) {
      return res.status(402).json({
        error: `Insufficient coins. You need ${PROBLEM_CREATION_COST} coins to create a problem.`,
      })
    }
    coinsDeducted = PROBLEM_CREATION_COST
  } else {
    // Admins bypass coin cost — just fetch current user for response
    updatedUser = await User.findById(userId).select('coins role')
  }

  // ── Create ProblemRequest doc ────────────────────────────────────────────
  const problemRequest = await ProblemRequest.create({
    requestedBy: userId,
    requesterRole: req.user.role,
    prompt: prompt.trim(),
    coinsDeducted,
    status: 'queued',
  })

  // ── Record coin transaction (only for users) ─────────────────────────────
  if (coinsDeducted > 0) {
    await CoinTransaction.create({
      userId,
      type: 'problem_creation',
      amount: -PROBLEM_CREATION_COST,
      balanceAfter: updatedUser.coins,
      referenceId: problemRequest._id,
      referenceModel: 'ProblemRequest',
      note: 'AI problem creation cost',
    })
  }

  // ── Publish to RabbitMQ ──────────────────────────────────────────────────
  try {
    publishProblemRequest({
      requestId: problemRequest._id.toString(),
      prompt: prompt.trim(),
      requesterRole: req.user.role,
      userId: userId.toString(),
    })
  } catch (mqErr) {
    // RabbitMQ publish failed — refund coins and mark job as failed
    console.error('[createProblemRequest] RabbitMQ publish failed:', mqErr.message)

    await ProblemRequest.findByIdAndUpdate(problemRequest._id, {
      status: 'failed',
      errorMessage: 'Failed to queue the job. Please try again.',
      errorStage: 'queue',
    })

    if (coinsDeducted > 0) {
      await User.findByIdAndUpdate(userId, { $inc: { coins: PROBLEM_CREATION_COST } })
      await CoinTransaction.create({
        userId,
        type: 'refund',
        amount: PROBLEM_CREATION_COST,
        balanceAfter: updatedUser.coins + PROBLEM_CREATION_COST,
        referenceId: problemRequest._id,
        referenceModel: 'ProblemRequest',
        note: 'Refund: queue publish failed',
      })
    }

    return res.status(503).json({
      error: 'Problem generation service is temporarily unavailable. Your coins have been refunded.',
    })
  }

  res.status(201).json({
    message: 'Problem request queued successfully!',
    requestId: problemRequest._id,
    coinsDeducted,
    coinsRemaining: updatedUser.coins,
    status: 'queued',
  })
}

// ─── GET /api/problems/request/:id ───────────────────────────────────────────
const getProblemRequestStatus = async (req, res) => {
  const { id } = req.params
  const userId = req.user.userId

  const request = await ProblemRequest.findById(id)
    .select('-generations.testCases -generations.testCaseScripts') // keep payload slim for polling
    .lean()

  if (!request) return res.status(404).json({ error: 'Request not found.' })

  // Users can only see their own requests; admins can see all
  if (req.user.role !== 'admin' && request.requestedBy.toString() !== userId) {
    return res.status(403).json({ error: 'Access denied.' })
  }

  res.json({ request })
}

// ─── GET /api/problems/requests ──────────────────────────────────────────────
const listMyProblemRequests = async (req, res) => {
  const userId = req.user.userId
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10))
  const skip = (page - 1) * limit

  const filter = req.user.role === 'admin' ? {} : { requestedBy: userId }

  const [requests, total] = await Promise.all([
    ProblemRequest.find(filter)
      .select('prompt status currentStage coinsDeducted createdAt resultProblemId errorMessage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProblemRequest.countDocuments(filter),
  ])

  res.json({ requests, total, page, totalPages: Math.ceil(total / limit) })
}

// ─── GET /api/problems/coins ─────────────────────────────────────────────────
const getCoinBalance = async (req, res) => {
  const userId = req.user.userId

  const [user, transactions] = await Promise.all([
    User.findById(userId).select('coins').lean(),
    CoinTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('type amount balanceAfter note createdAt')
      .lean(),
  ])

  if (!user) return res.status(404).json({ error: 'User not found.' })

  res.json({ coins: user.coins, recentTransactions: transactions })
}

module.exports = {
  createProblemRequest,
  getProblemRequestStatus,
  listMyProblemRequests,
  getCoinBalance,
}
