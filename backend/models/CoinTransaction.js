/**
 * CoinTransaction.js
 *
 * Append-only ledger of all coin movements per user.
 * Never mutate; only insert. Balance is derived from User.coins (denormalized
 * for read speed) but this log is the source of truth for auditing.
 *
 * Types:
 *   signup_bonus         +500   on account creation
 *   problem_creation     -200   when user submits an AI problem request
 *   problem_publish_reward +1000 when a user-created problem is published
 *   refund               +200   when AI generation fails
 *   admin_adjustment     ±n     manual admin override
 *
 * Indices:
 *   - userId + createdAt  : "my transaction history" (most recent first)
 *   - referenceId         : look up transactions tied to a specific problem/request
 */

const mongoose = require('mongoose')

const coinTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'signup_bonus',
        'problem_creation',
        'problem_publish_reward',
        'refund',
        'admin_adjustment',
      ],
      required: true,
    },
    // Positive = credit, negative = debit
    amount: {
      type: Number,
      required: true,
    },
    // Balance after this transaction (snapshot for fast history rendering)
    balanceAfter: {
      type: Number,
      required: true,
    },
    // Optional: link to the ProblemRequest or Problem that caused this tx
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceModel: {
      type: String,
      enum: ['ProblemRequest', 'Problem', null],
      default: null,
    },
    note: { type: String, default: '' },
  },
  {
    timestamps: true,
    // Prevent accidental updates to financial records
    strict: true,
  }
)

// ── Indices ───────────────────────────────────────────────────────────────────
coinTransactionSchema.index({ userId: 1, createdAt: -1 })
coinTransactionSchema.index({ referenceId: 1 })

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema)
