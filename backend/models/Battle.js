/**
 * Battle.js
 *
 * Represents a 1v1 competitive programming battle between two users.
 * Battles use published problems from our DB as the challenge.
 * Judge integration via judge-service handles submissions in real-time.
 *
 * Status lifecycle: active → completed | cancelled
 */

const mongoose = require('mongoose')

// Per-player state embedded inside a battle document
const playerStateSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username:   { type: String, default: '' },
    avatar:     { type: String, default: '' },
    rating:     { type: Number, default: 1200 },
    code:       { type: String, default: '' },
    language:   { type: String, default: 'cpp' },
    attempts:   { type: Number, default: 0 },
    solved:     { type: Boolean, default: false },
    solveTimeMs:{ type: Number, default: null },
    ratingDelta:{ type: Number, default: 0 },
  },
  { _id: false }
)

const battleSchema = new mongoose.Schema(
  {
    battleId:   { type: String, required: true, unique: true, index: true },
    player1:    { type: playerStateSchema, required: true },
    player2:    { type: playerStateSchema, required: true },

    problem: {
      problemId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', default: null },
      title:      { type: String, default: '' },
      slug:       { type: String, default: '' },
      difficulty: { type: String, default: 'medium' },
      timeLimitMs:{ type: Number, default: 2000 },
    },

    status:     { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },

    winner:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    draw:       { type: Boolean, default: false },

    startedAt:  { type: Date, default: Date.now },
    endedAt:    { type: Date, default: null },
    durationMs: { type: Number, default: 30 * 60 * 1000 },

    isChallenge:    { type: Boolean, default: false },
  },
  { timestamps: true }
)

// Index for fetching a user's battle history efficiently
battleSchema.index({ 'player1.userId': 1, createdAt: -1 })
battleSchema.index({ 'player2.userId': 1, createdAt: -1 })

module.exports = mongoose.model('Battle', battleSchema)
