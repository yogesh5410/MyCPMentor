/**
 * controllers/battle.controller.js
 *
 * REST endpoints for battle history and stats.
 * Real-time battle logic is handled by battleSocket.js.
 */

const Battle = require('../models/Battle')
const User   = require('../models/User')

// GET /api/battles/stats
exports.getStats = async (req, res) => {
  const userId = req.user.userId
  const user = await User.findById(userId)
    .select('rating name avatar battleWins battleLosses battleDraws battleStreak')
    .lean()
  if (!user) return res.status(404).json({ error: 'User not found.' })

  const total = (user.battleWins || 0) + (user.battleLosses || 0) + (user.battleDraws || 0)
  const winRate = total > 0 ? Math.round(((user.battleWins || 0) / total) * 100) : null

  res.json({
    rating:   user.rating   || 1200,
    wins:     user.battleWins   || 0,
    losses:   user.battleLosses || 0,
    draws:    user.battleDraws  || 0,
    streak:   user.battleStreak || 0,
    total,
    winRate,
  })
}

// GET /api/battles/history
exports.getHistory = async (req, res) => {
  const userId = req.user.userId

  const battles = await Battle.find({
    $or: [{ 'player1.userId': userId }, { 'player2.userId': userId }],
    status: 'completed',
  })
    .sort({ endedAt: -1 })
    .limit(50)
    .lean()

  const history = battles.map((b) => {
    const isP1 = String(b.player1.userId) === String(userId)
    const me   = isP1 ? b.player1 : b.player2
    const opp  = isP1 ? b.player2 : b.player1

    let result = 'draw'
    if (!b.draw) {
      result = String(b.winner) === String(userId) ? 'win' : 'loss'
    }

    return {
      battleId:     b.battleId,
      opponent:     { username: opp.username, avatar: opp.avatar, rating: opp.rating },
      problem:      b.problem,
      result,
      ratingDelta:  me.ratingDelta,
      solveTimeMs:  me.solveTimeMs,
      attempts:     me.attempts,
      endedAt:      b.endedAt,
      difficulty:   b.difficulty,
    }
  })

  res.json({ history })
}
