/**
 * controllers/problemRequest.controller.js
 *
 * Problem request endpoints (currently disabled for basic setup)
 */

const createProblemRequest = async (req, res) => {
  return res.status(503).json({
    error: 'Problem creation service is currently disabled in this basic setup.',
  })
}

const getProblemRequestStatus = async (req, res) => {
  return res.status(503).json({
    error: 'Problem creation service is currently disabled in this basic setup.',
  })
}

const listMyProblemRequests = async (req, res) => {
  return res.status(503).json({
    error: 'Problem creation service is currently disabled in this basic setup.',
  })
}

const getCoinBalance = async (req, res) => {
  return res.status(503).json({
    error: 'Problem creation service is currently disabled in this basic setup.',
  })
}

module.exports = {
  createProblemRequest,
  getProblemRequestStatus,
  listMyProblemRequests,
  getCoinBalance,
}
