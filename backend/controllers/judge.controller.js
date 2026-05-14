/**
 * judge.controller.js
 *
 * Proxies code execution requests to the judge-service (port 8001).
 * Two operations:
 *   run    – runs code against the problem's public test cases
 *   submit – runs code against the problem's private test cases
 *
 * The frontend never talks to judge-service directly (CORS + security).
 */

const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const Problem = require('../models/Problem')

const JUDGE_URL = process.env.JUDGE_SERVICE_URL || 'http://localhost:8001'

// Map frontend language labels to judge-service enum values
const LANG_MAP = {
  cpp: 'cpp',
  python: 'python',
  javascript: 'javascript',
}

async function callJudgeSync(userId, problemId, code, language, testCases, timeLimitSec) {
  const body = {
    submission_id: uuidv4(),
    user_id: String(userId),
    problem_id: String(problemId),
    code,
    language,
    test_cases: testCases,
    time_limit: Math.max(1, Math.min(10, timeLimitSec)),
    memory_limit: 256,
  }

  const response = await axios.post(`${JUDGE_URL}/api/judge/judge-sync`, body, {
    timeout: 60_000, // max 60 s to wait for judge
  })
  return response.data
}

// POST /api/judge/run
// Body: { slug, code, language }
// Runs against publicTests only. Returns judge result with per-TC info.
exports.run = async (req, res) => {
  const { slug, code, language } = req.body

  if (!slug || !code || !language) {
    return res.status(400).json({ error: 'slug, code, and language are required.' })
  }

  const langKey = LANG_MAP[language]
  if (!langKey) {
    return res.status(400).json({ error: `Unsupported language: ${language}. Use cpp, python, or javascript.` })
  }

  const problem = await Problem.findOne({ slug, status: 'published' })
    .select('_id timeLimitMs publicTests')
    .lean()

  if (!problem) {
    return res.status(404).json({ error: 'Problem not found.' })
  }

  if (!problem.publicTests || problem.publicTests.length === 0) {
    return res.status(400).json({ error: 'This problem has no public test cases.' })
  }

  const testCases = problem.publicTests.map((tc) => ({
    input: tc.input || '',
    expected_output: tc.expected_output || tc.output || '',
    is_hidden: false,
  }))

  const timeLimitSec = Math.ceil((problem.timeLimitMs || 2000) / 1000)

  try {
    const result = await callJudgeSync(
      req.user.userId,
      problem._id,
      code,
      langKey,
      testCases,
      timeLimitSec
    )
    return res.json(result)
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({ error: err.response.data?.detail || 'Judge service error.' })
    }
    return res.status(502).json({ error: 'Judge service unreachable.' })
  }
}

// POST /api/judge/submit
// Body: { slug, code, language }
// Runs against privateTests (hidden from frontend). Returns aggregated verdict.
exports.submit = async (req, res) => {
  const { slug, code, language } = req.body

  if (!slug || !code || !language) {
    return res.status(400).json({ error: 'slug, code, and language are required.' })
  }

  const langKey = LANG_MAP[language]
  if (!langKey) {
    return res.status(400).json({ error: `Unsupported language: ${language}. Use cpp, python, or javascript.` })
  }

  const problem = await Problem.findOne({ slug, status: 'published' })
    .select('_id timeLimitMs privateTests totalSubmissions acceptedSubmissions')

  if (!problem) {
    return res.status(404).json({ error: 'Problem not found.' })
  }

  const testCases = (problem.privateTests || []).map((tc) => ({
    input: tc.input || '',
    expected_output: tc.expected_output || tc.output || '',
    is_hidden: true,
  }))

  if (testCases.length === 0) {
    return res.status(400).json({ error: 'This problem has no private test cases.' })
  }

  const timeLimitSec = Math.ceil((problem.timeLimitMs || 2000) / 1000)

  try {
    const result = await callJudgeSync(
      req.user.userId,
      problem._id,
      code,
      langKey,
      testCases,
      timeLimitSec
    )

    // Update submission stats
    problem.totalSubmissions = (problem.totalSubmissions || 0) + 1
    if (result.verdict === 'AC' || result.verdict === 'Accepted') {
      problem.acceptedSubmissions = (problem.acceptedSubmissions || 0) + 1
    }
    await problem.save()

    // Strip expected output from hidden test results before returning
    if (result.test_results) {
      result.test_results = result.test_results.map((tr) => ({
        test_case_index: tr.test_case_index,
        verdict: tr.verdict,
        time_ms: tr.time_ms,
        memory_mb: tr.memory_mb,
        stderr: tr.stderr,
        // Do NOT return stdout/expected for hidden tests
      }))
    }

    return res.json(result)
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({ error: err.response.data?.detail || 'Judge service error.' })
    }
    return res.status(502).json({ error: 'Judge service unreachable.' })
  }
}
