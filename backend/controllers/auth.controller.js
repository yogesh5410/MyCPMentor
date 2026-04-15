const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const OTP = require('../models/OTP')
const CoinTransaction = require('../models/CoinTransaction')
const { sendOTPEmail } = require('../config/mailer')

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * grantSignupBonus — atomically adds 500 coins to a new user and records
 * the transaction in the CoinTransaction ledger.
 * Uses findOneAndUpdate for atomicity (no read-modify-write race).
 */
async function grantSignupBonus(userId) {
  const BONUS = 500
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { coins: BONUS } },
    { new: true, select: 'coins' }
  )
  await CoinTransaction.create({
    userId,
    type: 'signup_bonus',
    amount: BONUS,
    balanceAfter: updated.coins,
    note: 'Welcome bonus for new account',
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateToken = (user) =>
  jwt.sign(
    { userId: user._id, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

// HTTP-only cookie config:
// - httpOnly: JS cannot read this cookie (protects against XSS)
// - secure: only sent over HTTPS in production
// - sameSite: 'lax' allows the cookie on top-level navigation (needed for OAuth redirect)
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── POST /api/auth/send-otp ──────────────────────────────────────────────────
// Validates email → generates 6-digit OTP → bcrypt-hashes it → saves to DB
// (replacing any old OTPs for that email) → sends via Nodemailer Gmail OAuth2

const sendOTP = async (req, res) => {
  const { email } = req.body

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Secondary rate limit: max 3 OTPs per email per 10 minutes
  // (IP-level rate limit is handled by express-rate-limit in the route)
  const recentCount = await OTP.countDocuments({
    email: normalizedEmail,
    createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) },
  })
  if (recentCount >= 3) {
    return res.status(429).json({
      error: 'Too many code requests for this email. Please wait 10 minutes.',
    })
  }

  // Cryptographically random 6-digit OTP (not Math.random — which is not CSPRNG)
  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const otpHash = await bcrypt.hash(otp, 10)

  // Replace any existing OTPs for this email (prevents old codes working)
  await OTP.deleteMany({ email: normalizedEmail })
  await OTP.create({ email: normalizedEmail, otpHash })

  try {
    await sendOTPEmail(normalizedEmail, otp)
    res.json({ message: 'Code sent. Check your inbox.' })
  } catch (err) {
    console.error('[sendOTP] email error:', err.message)
    // Clean up the OTP we just created — no point keeping it if email failed
    await OTP.deleteMany({ email: normalizedEmail })
    res.status(500).json({ error: 'Failed to send the email. Please try again.' })
  }
}

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
// Finds the latest OTP record for the email → bcrypt.compare → deletes it
// (one-time use) → finds or creates user → issues JWT

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and code are required.' })
  }
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Code must be exactly 6 digits.' })
  }

  const normalizedEmail = email.toLowerCase().trim()

  const record = await OTP.findOne({ email: normalizedEmail }).sort({ createdAt: -1 })

  if (!record) {
    return res.status(400).json({
      error: 'Code expired or not found. Request a new one.',
    })
  }

  const isValid = await bcrypt.compare(otp, record.otpHash)

  if (!isValid) {
    return res.status(400).json({ error: 'Incorrect code. Please try again.' })
  }

  // Valid — consume it immediately (one-time use)
  await OTP.deleteMany({ email: normalizedEmail })

  // Find or create user
  let user = await User.findOne({ email: normalizedEmail })
  const isNewUser = !user
  if (!user) {
    user = await User.create({ email: normalizedEmail })
    await grantSignupBonus(user._id)
    // Re-fetch so user.coins reflects the bonus
    user = await User.findById(user._id)
  }

  const token = generateToken(user)
  res.cookie('token', token, cookieOptions)

  res.json({
    message: isNewUser ? 'Account created! Welcome to MyCPMentor.' : 'Welcome back!',
    token, // also returned in body so frontend can store in memory/localStorage
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      rating: user.rating,
      coins: user.coins,
      role: user.role,
    },
    isNewUser,
  })
}

// ─── GET /api/auth/google/callback (runs after Passport attaches req.user) ───
// Issues JWT, sets cookie, redirects to frontend /auth/callback with token

const googleCallback = (req, res) => {
  const token = generateToken(req.user)
  res.cookie('token', token, cookieOptions)
  // Pass token in query param — the frontend /auth/callback page reads and stores it
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`)
}

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  const user = await User.findById(req.user.userId).select('-__v')
  if (!user) return res.status(404).json({ error: 'User not found.' })
  res.json({ user })
}

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
const logout = (_req, res) => {
  res.clearCookie('token')
  res.json({ message: 'Logged out successfully.' })
}

module.exports = { sendOTP, verifyOTP, googleCallback, getMe, logout }
