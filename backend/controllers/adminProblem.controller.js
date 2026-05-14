/**
 * controllers/adminProblem.controller.js
 *
 * Admin: list, approve, reject, and fetch problems in the review queue.
 *
 * Routes mounted under /api/admin/problems
 */

const Problem = require('../models/Problem')

// ── GET /api/admin/problems ──────────────────────────────────────────────────
// Returns problems filtered by status (default: pending_review + published)

exports.listProblems = async (req, res) => {
  try {
    const { status, page = 1, limit = 30 } = req.query
    const filter = {}
    if (status) {
      filter.status = status
    } else {
      filter.status = { $in: ['pending_review', 'published', 'rejected'] }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [problems, total] = await Promise.all([
      Problem.find(filter)
        .select('title slug difficulty tags status creatorRole aiJobId createdAt reviewedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Problem.countDocuments(filter),
    ])

    res.json({ problems, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    console.error('[AdminProblem] listProblems error:', err.message)
    res.status(500).json({ error: 'Failed to list problems' })
  }
}

// ── GET /api/admin/problems/:id ──────────────────────────────────────────────

exports.getProblem = async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id).lean()
    if (!problem) return res.status(404).json({ error: 'Problem not found' })
    res.json(problem)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch problem' })
  }
}

// ── POST /api/admin/problems/:id/approve ─────────────────────────────────────

exports.approveProblem = async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id)
    if (!problem) return res.status(404).json({ error: 'Problem not found' })
    if (problem.status === 'published') {
      return res.status(400).json({ error: 'Problem is already published' })
    }

    problem.status = 'published'
    problem.reviewedBy = req.user.userId
    problem.reviewedAt = new Date()
    await problem.save()

    res.json({ success: true, problemId: problem._id, slug: problem.slug })
  } catch (err) {
    console.error('[AdminProblem] approveProblem error:', err.message)
    res.status(500).json({ error: 'Failed to approve problem' })
  }
}

// ── POST /api/admin/problems/:id/reject ──────────────────────────────────────

exports.rejectProblem = async (req, res) => {
  try {
    const { reason = '' } = req.body
    const problem = await Problem.findById(req.params.id)
    if (!problem) return res.status(404).json({ error: 'Problem not found' })

    problem.status = 'rejected'
    problem.rejectionReason = reason
    problem.reviewedBy = req.user.userId
    problem.reviewedAt = new Date()
    await problem.save()

    res.json({ success: true })
  } catch (err) {
    console.error('[AdminProblem] rejectProblem error:', err.message)
    res.status(500).json({ error: 'Failed to reject problem' })
  }
}
