/**
 * controllers/adminReview.controller.js
 *
 * Admin-only endpoints for reviewing AI-generated problems.
 *
 *   GET  /api/admin/problems/review        — paginated queue of pending problems
 *   GET  /api/admin/problems/review/:id    — full problem detail (all 12 test cases)
 *   POST /api/admin/problems/review/:id/publish  — publish and optionally reward creator
 *   POST /api/admin/problems/review/:id/reject   — reject with reason
 */

const Problem = require('../models/Problem')
const ProblemRequest = require('../models/ProblemRequest')
const User = require('../models/User')
const CoinTransaction = require('../models/CoinTransaction')

const PUBLISH_REWARD = 1000

// ─── GET /api/admin/problems/review ──────────────────────────────────────────
const getReviewQueue = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10))
  const skip = (page - 1) * limit

  const [problems, total] = await Promise.all([
    Problem.find({ status: 'pending_review' })
      .select(
        'title difficulty tags createdBy creatorRole optimalTimeComplexity optimalSpaceComplexity timeLimitMs memoryLimitMb createdAt'
      )
      .populate('createdBy', 'name email')
      .sort({ createdAt: 1 }) // oldest first (FIFO review)
      .skip(skip)
      .limit(limit)
      .lean(),
    Problem.countDocuments({ status: 'pending_review' }),
  ])

  res.json({ problems, total, page, totalPages: Math.ceil(total / limit) })
}

// ─── GET /api/admin/problems/review/:id ──────────────────────────────────────
const getReviewDetail = async (req, res) => {
  const problem = await Problem.findById(req.params.id)
    .populate('createdBy', 'name email coins')
    .populate('requestId', 'prompt generations.review')
    .lean()

  if (!problem) return res.status(404).json({ error: 'Problem not found.' })

  // Return all 12 test cases (2 public + 10 private) for admin review
  res.json({ problem })
}

// ─── POST /api/admin/problems/review/:id/publish ─────────────────────────────
const publishProblem = async (req, res) => {
  const adminId = req.user.userId

  const problem = await Problem.findOne({
    _id: req.params.id,
    status: 'pending_review',
  })

  if (!problem) {
    return res.status(404).json({ error: 'Problem not found or already reviewed.' })
  }

  problem.status = 'published'
  problem.reviewedBy = adminId
  problem.reviewedAt = new Date()
  await problem.save()

  // ── Reward user if they created the problem ──────────────────────────────
  let rewardGranted = false
  if (problem.creatorRole === 'user') {
    const updated = await User.findByIdAndUpdate(
      problem.createdBy,
      { $inc: { coins: PUBLISH_REWARD } },
      { new: true, select: 'coins' }
    )
    if (updated) {
      await CoinTransaction.create({
        userId: problem.createdBy,
        type: 'problem_publish_reward',
        amount: PUBLISH_REWARD,
        balanceAfter: updated.coins,
        referenceId: problem._id,
        referenceModel: 'Problem',
        note: `Reward for published problem: ${problem.title}`,
      })
      rewardGranted = true
    }
  }

  res.json({
    message: 'Problem published successfully.',
    problemId: problem._id,
    rewardGranted,
    rewardAmount: rewardGranted ? PUBLISH_REWARD : 0,
  })
}

// ─── POST /api/admin/problems/review/:id/reject ──────────────────────────────
const rejectProblem = async (req, res) => {
  const { reason } = req.body
  const adminId = req.user.userId

  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ error: 'Please provide a rejection reason (min 5 chars).' })
  }

  const problem = await Problem.findOne({
    _id: req.params.id,
    status: 'pending_review',
  })

  if (!problem) {
    return res.status(404).json({ error: 'Problem not found or already reviewed.' })
  }

  problem.status = 'rejected'
  problem.reviewedBy = adminId
  problem.reviewedAt = new Date()
  problem.rejectionReason = reason.trim()
  await problem.save()

  res.json({ message: 'Problem rejected.', problemId: problem._id })
}

module.exports = { getReviewQueue, getReviewDetail, publishProblem, rejectProblem }
