// Passport.js Google OAuth2 Strategy
//
// Flow:
//   1. User clicks "Continue with Google" → frontend hits GET /api/auth/google
//   2. Passport redirects user to Google's consent screen
//   3. After consent, Google redirects to GOOGLE_CALLBACK_URL with a code
//   4. Passport exchanges the code for tokens and calls Google for profile info
//   5. Our verify callback finds or creates the user in MongoDB
//   6. We call done(null, user) — passport attaches user to req.user
//   7. Our googleCallback controller issues a JWT and redirects to frontend

const passport = require('passport')
const { Strategy: GoogleStrategy } = require('passport-google-oauth20')
const User = require('../models/User')
const CoinTransaction = require('../models/CoinTransaction')

async function grantSignupBonusIfNew(userId) {
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

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value
        if (!email) return done(new Error('No email returned from Google'), null)

        // Try to find by googleId first (returning Google OAuth user)
        let user = await User.findOne({ googleId: profile.id })

        if (!user) {
          // Check if they signed up with OTP using the same email before
          user = await User.findOne({ email: email.toLowerCase() })

          if (user) {
            // Link Google account to existing OTP-based account
            user.googleId = profile.id
            user.avatar = user.avatar || profile.photos?.[0]?.value || ''
            user.name = user.name || profile.displayName || ''
            await user.save()
          } else {
            // Brand new user via Google — create and grant signup bonus
            user = await User.create({
              googleId: profile.id,
              email: email.toLowerCase(),
              name: profile.displayName || '',
              avatar: profile.photos?.[0]?.value || '',
            })
            await grantSignupBonusIfNew(user._id)
          }
        }

        return done(null, user)
      } catch (err) {
        return done(err, null)
      }
    }
  )
)

// We use session: false (JWT-based, not server sessions)
// so we don't need serializeUser / deserializeUser

module.exports = passport

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value
        if (!email) return done(new Error('No email returned from Google'), null)

        // Try to find by googleId first (returning Google OAuth user)
        let user = await User.findOne({ googleId: profile.id })

        if (!user) {
          // Check if they signed up with OTP using the same email before
          user = await User.findOne({ email: email.toLowerCase() })

          if (user) {
            // Link Google account to existing OTP-based account
            user.googleId = profile.id
            user.avatar = user.avatar || profile.photos?.[0]?.value || ''
            user.name = user.name || profile.displayName || ''
            await user.save()
          } else {
            // Brand new user via Google
            user = await User.create({
              googleId: profile.id,
              email: email.toLowerCase(),
              name: profile.displayName || '',
              avatar: profile.photos?.[0]?.value || '',
            })
          }
        }

        return done(null, user)
      } catch (err) {
        return done(err, null)
      }
    }
  )
)

// We use session: false (JWT-based, not server sessions)
// so we don't need serializeUser / deserializeUser

module.exports = passport
