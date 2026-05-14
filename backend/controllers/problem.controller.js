/**
 * controllers/problem.controller.js
 *
 * Public-facing problem browsing (published problems only).
 *
 * Routes mounted under /api/problems
 */

const Problem = require('../models/Problem')

// ── GET /api/problems ────────────────────────────────────────────────────────
// Returns published problems with optional filters

exports.listPublished = async (req, res) => {
  try {
    const { difficulty, tags, page = 1, limit = 50, search } = req.query
    const filter = { status: 'published' }

    if (difficulty) filter.difficulty = difficulty
    if (tags) filter.tags = { $in: tags.split(',').map((t) => t.trim()) }
    if (search) filter.title = { $regex: search, $options: 'i' }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [problems, total] = await Promise.all([
      Problem.find(filter)
        .select('title slug difficulty tags timeLimitMs memoryLimitMb creatorRole totalSubmissions acceptedSubmissions createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Problem.countDocuments(filter),
    ])

    res.json({ problems, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    console.error('[Problem] listPublished error:', err.message)
    res.status(500).json({ error: 'Failed to list problems' })
  }
}

// ── GET /api/problems/:slug ──────────────────────────────────────────────────
// Returns full problem (without private test cases and solution)

exports.getProblemBySlug = async (req, res) => {
  try {
    const problem = await Problem.findOne(
      { slug: req.params.slug, status: 'published' },
      { privateTests: 0, solutionCpp: 0 }
    ).lean()
    if (!problem) return res.status(404).json({ error: 'Problem not found' })
    res.json(problem)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch problem' })
  }
}
