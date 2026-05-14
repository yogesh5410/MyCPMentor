/**
 * controllers/aiProblem.controller.js
 *
 * Proxies requests to the ai-service microservice and handles
 * the Publish action (writes the approved AI problem into MongoDB).
 */

const axios = require('axios')
const Problem = require('../models/Problem')

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8002'

// ── Helpers ────────────────────────────────────────────────────────────────

function _cfRatingToDifficulty(rating) {
  if (rating <= 1300) return 'easy'
  if (rating <= 2000) return 'medium'
  return 'hard'
}

// ── POST /api/admin/ai/generate ─────────────────────────────────────────────

exports.generateProblem = async (req, res) => {
  try {
    const { topics, difficulty, idea } = req.body
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: 'topics array is required' })
    }

    const response = await axios.post(`${AI_URL}/api/ai/generate`, {
      topics,
      difficulty: difficulty || 1400,
      idea: idea || null,
    })

    res.status(202).json(response.data)
  } catch (err) {
    console.error('[AI] generate error:', err.message)
    res.status(502).json({ error: 'Failed to queue generation job in ai-service' })
  }
}

// ── GET /api/admin/ai/jobs/:jobId ───────────────────────────────────────────

exports.getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params
    const response = await axios.get(`${AI_URL}/api/ai/jobs/${jobId}`)
    res.json(response.data)
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: 'Job not found' })
    }
    console.error('[AI] getJobStatus error:', err.message)
    res.status(502).json({ error: 'Failed to fetch job status from ai-service' })
  }
}

// ── GET /api/admin/ai/jobs ──────────────────────────────────────────────────

exports.listJobs = async (req, res) => {
  try {
    const response = await axios.get(`${AI_URL}/api/ai/jobs`)
    res.json(response.data)
  } catch (err) {
    console.error('[AI] listJobs error:', err.message)
    res.status(502).json({ error: 'Failed to list jobs from ai-service' })
  }
}

// ── POST /api/admin/ai/jobs/:jobId/publish ──────────────────────────────────

exports.publishAIProblem = async (req, res) => {
  try {
    const { jobId } = req.params
    const adminId = req.user.userId

    // Fetch full job data from ai-service
    const jobResp = await axios.get(`${AI_URL}/api/ai/jobs/${jobId}`)
    const job = jobResp.data

    if (job.status !== 'completed') {
      return res.status(400).json({
        error: `Job is '${job.status}', not 'completed'. Cannot publish.`,
      })
    }

    const testCases = job.test_cases || []
    const publicTcs = testCases.filter((tc) => !tc.is_hidden)
    const privateTcs = testCases.filter((tc) => tc.is_hidden)

    // We need exactly 2 public and 10 private
    if (publicTcs.length < 2 || privateTcs.length < 10) {
      return res.status(400).json({
        error: `Need ≥ 2 public + ≥ 10 private test cases. Got ${publicTcs.length} + ${privateTcs.length}.`,
        hint: 'Regenerate the problem to produce more test cases.',
      })
    }

    // Build mongoose-compatible test case arrays
    const toMongoTc = (tc) => ({ input: tc.input, output: tc.expected_output })

    // MongoDB document limit is 16 MB. Large test cases (n=10^5 arrays) can
    // easily blow that. Only store test cases whose raw text ≤ 500 KB each;
    // the full set is always retrievable via aiJobId from the AI service.
    const MAX_TC_BYTES = 500_000
    const fitsInMongo = (tc) =>
      (tc.input?.length || 0) + (tc.expected_output?.length || 0) <= MAX_TC_BYTES

    const storedPublic = publicTcs.filter(fitsInMongo).slice(0, 2)
    const storedPrivate = privateTcs.filter(fitsInMongo).slice(0, 10)

    // Fall back to truncated versions if nothing is small enough
    const ensurePublic =
      storedPublic.length >= 1
        ? storedPublic
        : publicTcs.slice(0, 2).map((tc) => ({
            ...tc,
            input: tc.input?.slice(0, 100_000) || '',
            expected_output: tc.expected_output?.slice(0, 100_000) || '',
          }))

    const ensurePrivate =
      storedPrivate.length >= 1
        ? storedPrivate
        : privateTcs.slice(0, 10).map((tc) => ({
            ...tc,
            input: tc.input?.slice(0, 100_000) || '',
            expected_output: tc.expected_output?.slice(0, 100_000) || '',
          }))

    const problem = new Problem({
      title: job.name,
      description: job.description,
      inputFormat: job.input_format || '',
      outputFormat: job.output_format || '',
      sampleInput: job.sample_input || '',
      sampleOutput: job.sample_output || '',
      sampleExplanation: job.sample_explanation || '',
      constraints: job.constraints,
      timeLimitMs: job.time_limit_ms || 1000,
      memoryLimitMb: job.memory_limit_mb || 256,
      optimalTimeComplexity: job.time_complexity || 'O(n)',
      optimalSpaceComplexity: job.space_complexity || 'O(1)',
      solutionCpp: job.solution_cpp || `// Python solution:\n${job.solution_code || ''}`,
      publicTests: ensurePublic.map(toMongoTc),
      privateTests: ensurePrivate.map(toMongoTc),
      difficulty: _cfRatingToDifficulty(job.difficulty || 1400),
      tags: Array.isArray(job.tags) && job.tags.length ? job.tags : job.topics,
      createdBy: adminId,
      creatorRole: 'admin',
      status: 'pending_review',
      aiJobId: jobId,
    })

    await problem.save()

    res.json({
      success: true,
      problemId: problem._id,
      slug: problem.slug,
      title: problem.title,
    })
  } catch (err) {
    console.error('[AI] publishAIProblem error:', err.message)
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: 'Failed to publish problem' })
  }
}

// ── POST /api/admin/ai/jobs/:jobId/reject ───────────────────────────────────

exports.rejectAIProblem = async (req, res) => {
  // Nothing to do except acknowledge — the job will expire from Redis in 24 h
  res.json({ success: true, message: 'Problem rejected and will be discarded.' })
}
