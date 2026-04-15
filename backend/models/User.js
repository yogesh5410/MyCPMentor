const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, default: '', trim: true },
    avatar: { type: String, default: '' },
    // googleId is null for OTP-only users, set when they link/sign up via Google
    googleId: { type: String, default: null, sparse: true },
    rating: { type: Number, default: 1200 },

    // ── Role ──────────────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    // ── Coins ─────────────────────────────────────────────────────────────────
    // Denormalised balance for O(1) reads. Source of truth = CoinTransaction ledger.
    // 500 signup bonus applied in auth.controller.js on first login.
    coins: {
      type: Number,
      default: 0,
      min: 0, // balance can never go below 0
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('User', userSchema)
