const express = require('express')
const rateLimit = require('express-rate-limit')
const passport = require('../config/passport')
const { requireAuth } = require('../middleware/auth')
const {
  sendOTP,
  verifyOTP,
  googleCallback,
  getMe,
  logout,
} = require('../controllers/auth.controller')

const router = express.Router()

// Rate limiting for OTP send:
// Max 5 requests per IP per 10 minutes. Prevents OTP spam from a single IP.
// The controller also checks per-email (max 3), so protection is two-layered.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: { error: 'Too many requests from this IP. Please try again in 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── OTP (Email) Auth ─────────────────────────────────────────────────────────
router.post('/send-otp', otpLimiter, sendOTP)
router.post('/verify-otp', verifyOTP)

// ─── Google OAuth ─────────────────────────────────────────────────────────────
// Step 1: redirect to Google consent screen
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

// Step 2: Google redirects here after user consents — session: false = no server sessions
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/auth?error=oauth_failed`,
  }),
  googleCallback
)

// ─── Shared ───────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, getMe)
router.post('/logout', logout)

module.exports = router
