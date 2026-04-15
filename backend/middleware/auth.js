const jwt = require('jsonwebtoken')
const User = require('../models/User')

// Middleware that verifies the JWT from:
//   1. HTTP-only cookie (set by our server — preferred, XSS-safe)
//   2. Authorization: Bearer <token> header (for API clients / mobile)

const requireAuth = (req, res, next) => {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace(/^Bearer\s+/, '')

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' })
  }
}

/**
 * requireAdmin — must be used AFTER requireAuth.
 * Fetches the user from DB to get their current role (not stale JWT claim).
 * This is intentional: if an admin is demoted, their next request is rejected
 * without waiting for the token to expire.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('role').lean()
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' })
    }
    req.user.role = 'admin'
    next()
  } catch {
    res.status(500).json({ error: 'Authorization check failed.' })
  }
}

module.exports = { requireAuth, requireAdmin }
