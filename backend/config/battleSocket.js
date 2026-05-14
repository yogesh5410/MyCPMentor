/**
 * config/battleSocket.js
 *
 * All Socket.io logic for the 1v1 live battle system.
 *
 * In-memory stores (ephemeral — battles persist to MongoDB):
 *   queue      : Map<userId, queueEntry>      — matchmaking queue
 *   challenges : Map<code,  challengeEntry>   — pending challenge rooms
 *   activeBattles: Map<battleId, { timerId }> — active battle timers
 *   userToBattle : Map<userId, battleId>      — quick lookup
 *   userToSocket : Map<userId, socket>        — active socket per user
 *   submitting   : Set<userId>               — prevent double-submit
 */

const jwt    = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const axios  = require('axios')
const Battle  = require('../models/Battle')
const User    = require('../models/User')
const Problem = require('../models/Problem')

const JUDGE_URL        = process.env.JUDGE_SERVICE_URL || 'http://localhost:8001'
const BATTLE_DURATION  = 30 * 60 * 1000   // 30 minutes
const RECONNECT_GRACE  = 60 * 1000        // 60 s before auto-forfeit

// ── In-memory state ───────────────────────────────────────────────────────────
const queue        = new Map()
const challenges   = new Map()
const activeBattles = new Map()
const userToBattle  = new Map()
const userToSocket  = new Map()
const submitting    = new Set()

let ioServer = null   // set by initBattleSocket

// ── Elo (K = 32 × weight 0.8 = 25.6) ────────────────────────────────────────
function calcElo(rA, rB, scoreA) {
  const K = 32 * 0.8
  const expected = 1 / (1 + Math.pow(10, (rB - rA) / 400))
  return Math.round(K * (scoreA - expected))
}

// Streak multiplier: +10% per 3-win tier (cap at 1.5×)
function streakMultiplier(streak) {
  if (streak < 3) return 1
  if (streak < 6) return 1.1
  if (streak < 9) return 1.3
  return 1.5
}

// ── Pick a random published problem matching difficulty ───────────────────────
async function pickProblem(difficulty) {
  let problems = await Problem.find({ status: 'published', difficulty })
    .select('_id title slug difficulty timeLimitMs')
    .lean()
  if (!problems.length) {
    problems = await Problem.find({ status: 'published' })
      .select('_id title slug difficulty timeLimitMs')
      .lean()
  }
  if (!problems.length) return null
  return problems[Math.floor(Math.random() * problems.length)]
}

// ── Call judge-service synchronously for private test cases ──────────────────
async function judgeSubmit(userId, problem, code, language) {
  const fullProblem = await Problem.findById(problem.problemId)
    .select('privateTests timeLimitMs')
    .lean()
  if (!fullProblem?.privateTests?.length) return null

  const testCases = fullProblem.privateTests.map((tc) => ({
    input: tc.input || '',
    expected_output: tc.output || tc.expected_output || '',
    is_hidden: true,
  }))

  const timeLimitSec = Math.max(1, Math.min(10, Math.ceil((fullProblem.timeLimitMs || 2000) / 1000)))
  const body = {
    submission_id: uuidv4(),
    user_id:    String(userId),
    problem_id: String(problem.problemId),
    code,
    language,
    test_cases:   testCases,
    time_limit:   timeLimitSec,
    memory_limit: 256,
  }
  const resp = await axios.post(`${JUDGE_URL}/api/judge/judge-sync`, body, { timeout: 65_000 })
  return resp.data
}

// ── Finish a battle: update DB + ratings + notify both players ─────────────
async function finishBattle(battleId, winnerId, isDraw = false) {
  const state = activeBattles.get(battleId)
  if (!state) return
  clearTimeout(state.timerId)
  activeBattles.delete(battleId)

  const battle = await Battle.findOne({ battleId })
  if (!battle || battle.status !== 'active') return

  battle.status = 'completed'
  battle.endedAt = new Date()
  battle.draw = isDraw
  battle.winner = isDraw ? null : winnerId

  const p1Id = String(battle.player1.userId)
  const p2Id = String(battle.player2.userId)

  // Fetch current streaks for multiplier
  const [u1, u2] = await Promise.all([
    User.findById(battle.player1.userId).select('battleStreak rating').lean(),
    User.findById(battle.player2.userId).select('battleStreak rating').lean(),
  ])

  const r1 = u1?.rating ?? battle.player1.rating
  const r2 = u2?.rating ?? battle.player2.rating
  const s1 = u1?.battleStreak ?? 0
  const s2 = u2?.battleStreak ?? 0

  let p1Delta = 0, p2Delta = 0

  if (isDraw) {
    p1Delta = calcElo(r1, r2, 0.5)
    p2Delta = calcElo(r2, r1, 0.5)
  } else {
    const p1Won = String(winnerId) === p1Id
    const winnerMul = p1Won ? streakMultiplier(s1) : streakMultiplier(s2)
    const loserMul  = p1Won ? streakMultiplier(s2) : streakMultiplier(s1)
    p1Delta = Math.round(calcElo(r1, r2, p1Won ? 1 : 0) * (p1Won ? winnerMul : loserMul))
    p2Delta = Math.round(calcElo(r2, r1, p1Won ? 0 : 1) * (p1Won ? loserMul : winnerMul))
  }

  battle.player1.ratingDelta = p1Delta
  battle.player2.ratingDelta = p2Delta
  await battle.save()

  // Update User stats
  if (isDraw) {
    await User.updateOne({ _id: battle.player1.userId }, { $inc: { rating: p1Delta, battleDraws: 1 }, $set: { battleStreak: 0 } })
    await User.updateOne({ _id: battle.player2.userId }, { $inc: { rating: p2Delta, battleDraws: 1 }, $set: { battleStreak: 0 } })
  } else {
    const p1Won = String(winnerId) === p1Id
    const winnerUserId = p1Won ? battle.player1.userId : battle.player2.userId
    const loserUserId  = p1Won ? battle.player2.userId : battle.player1.userId
    const wDelta = p1Won ? p1Delta : p2Delta
    const lDelta = p1Won ? p2Delta : p1Delta

    await User.updateOne({ _id: winnerUserId }, { $inc: { rating: wDelta, battleWins: 1, battleStreak: 1 } })
    await User.updateOne({ _id: loserUserId  }, { $inc: { rating: lDelta, battleLosses: 1 }, $set: { battleStreak: 0 } })
  }

  userToBattle.delete(p1Id)
  userToBattle.delete(p2Id)

  const resultPayload = {
    battleId,
    draw: isDraw,
    winnerId: isDraw ? null : String(winnerId),
    player1: {
      userId: p1Id,
      username: battle.player1.username,
      avatar: battle.player1.avatar,
      solved: battle.player1.solved,
      attempts: battle.player1.attempts,
      solveTimeMs: battle.player1.solveTimeMs,
      ratingDelta: p1Delta,
    },
    player2: {
      userId: p2Id,
      username: battle.player2.username,
      avatar: battle.player2.avatar,
      solved: battle.player2.solved,
      attempts: battle.player2.attempts,
      solveTimeMs: battle.player2.solveTimeMs,
      ratingDelta: p2Delta,
    },
  }

  ioServer.to(battleId).emit('battle:result', resultPayload)
}

// ── Handle time-up ────────────────────────────────────────────────────────────
async function handleTimeUp(battleId) {
  const battle = await Battle.findOne({ battleId }).lean()
  if (!battle || battle.status !== 'active') return

  ioServer.to(battleId).emit('battle:time_up', { battleId })

  const p1Solved = battle.player1.solved
  const p2Solved = battle.player2.solved

  if (p1Solved && !p2Solved) {
    await finishBattle(battleId, battle.player1.userId)
  } else if (p2Solved && !p1Solved) {
    await finishBattle(battleId, battle.player2.userId)
  } else {
    await finishBattle(battleId, null, true) // draw
  }
}

// ── Create a battle room and notify both players ──────────────────────────────
async function createBattle(p1, p2, difficulty, isChallenge = false) {
  const problem = await pickProblem(difficulty)
  if (!problem) {
    p1.socket.emit('battle:error', { message: 'No problems available for this difficulty. Try another.' })
    p2.socket.emit('battle:error', { message: 'No problems available for this difficulty. Try another.' })
    return null
  }

  const battleId   = uuidv4()
  const startedAt  = new Date()

  await Battle.create({
    battleId,
    player1: {
      userId:   p1.userId,
      username: p1.username,
      avatar:   p1.avatar,
      rating:   p1.rating,
    },
    player2: {
      userId:   p2.userId,
      username: p2.username,
      avatar:   p2.avatar,
      rating:   p2.rating,
    },
    problem: {
      problemId:   problem._id,
      title:       problem.title,
      slug:        problem.slug,
      difficulty:  problem.difficulty,
      timeLimitMs: problem.timeLimitMs || 2000,
    },
    status:     'active',
    difficulty,
    startedAt,
    durationMs: BATTLE_DURATION,
    isChallenge,
  })

  userToBattle.set(String(p1.userId), battleId)
  userToBattle.set(String(p2.userId), battleId)

  const timerId = setTimeout(() => handleTimeUp(battleId), BATTLE_DURATION)
  activeBattles.set(battleId, { timerId })

  p1.socket.join(battleId)
  p2.socket.join(battleId)

  const base = {
    battleId,
    problem: { title: problem.title, slug: problem.slug, difficulty: problem.difficulty },
    startedAt: startedAt.toISOString(),
    durationMs: BATTLE_DURATION,
  }

  p1.socket.emit('battle:matched', {
    ...base,
    opponent:  { userId: String(p2.userId), username: p2.username, avatar: p2.avatar, rating: p2.rating },
    myIndex:   1,
  })
  p2.socket.emit('battle:matched', {
    ...base,
    opponent:  { userId: String(p1.userId), username: p1.username, avatar: p1.avatar, rating: p1.rating },
    myIndex:   2,
  })

  return battleId
}

// ── Matchmaking: find a waiting opponent ──────────────────────────────────────
async function tryMatchmaking(newUserId) {
  const entry = queue.get(newUserId)
  if (!entry) return

  for (const [candidateId, candidate] of queue.entries()) {
    if (candidateId === newUserId) continue
    if (candidate.difficulty !== entry.difficulty) continue
    // Expand window with time: ±150 first 30s, ±300 after, ±600 after 60s
    const waitMs = Date.now() - entry.joinedAt
    const window = waitMs < 30_000 ? 150 : waitMs < 60_000 ? 300 : 600
    if (Math.abs(candidate.rating - entry.rating) > window) continue

    queue.delete(newUserId)
    queue.delete(candidateId)
    await createBattle(entry, candidate, entry.difficulty)
    break
  }
}

// ── 6-character alphanumeric challenge code ───────────────────────────────────
function genChallengeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ── Main initialiser ──────────────────────────────────────────────────────────
function initBattleSocket(io) {
  ioServer = io

  // ── JWT auth middleware ─────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('No token'))
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET)
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    const userId = String(socket.user.userId)
    userToSocket.set(userId, socket)

    // Reconnect: rejoin active battle room and send current state
    const existingBattleId = userToBattle.get(userId)
    if (existingBattleId) {
      socket.join(existingBattleId)
      const battle = await Battle.findOne({ battleId: existingBattleId, status: 'active' }).lean()
      if (battle) {
        const isP1 = String(battle.player1.userId) === userId
        const me  = isP1 ? battle.player1 : battle.player2
        const opp = isP1 ? battle.player2 : battle.player1
        socket.emit('battle:state_restored', {
          battleId:       existingBattleId,
          problem:        battle.problem,
          opponent:       { userId: String(opp.userId), username: opp.username, avatar: opp.avatar, rating: opp.rating },
          startedAt:      battle.startedAt.toISOString(),
          durationMs:     battle.durationMs,
          myIndex:        isP1 ? 1 : 2,
          myAttempts:     me.attempts,
          opponentAttempts: opp.attempts,
          opponentSolved: opp.solved,
          mySolved:       me.solved,
          myCode:         me.code,
          myLanguage:     me.language,
        })
      }
    }

    // ── Join random matchmaking queue ───────────────────────────────────────
    socket.on('battle:join_queue', async ({ difficulty } = {}) => {
      if (userToBattle.has(userId))
        return socket.emit('battle:error', { message: 'You are already in a battle.' })
      if (queue.has(userId))
        return socket.emit('battle:error', { message: 'Already in queue.' })

      const user = await User.findById(userId).select('rating name avatar').lean()
      if (!user) return socket.emit('battle:error', { message: 'User not found.' })

      const diff = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium'
      const entry = {
        socket,
        userId,
        username:  user.name || 'Player',
        avatar:    user.avatar || '',
        rating:    user.rating || 1200,
        difficulty: diff,
        joinedAt:   Date.now(),
      }
      queue.set(userId, entry)
      socket.emit('battle:queued', { difficulty: diff, yourRating: entry.rating })

      await tryMatchmaking(userId)

      // Retry matchmaking every 15s (expand window)
      const retryId = setInterval(async () => {
        if (!queue.has(userId)) return clearInterval(retryId)
        await tryMatchmaking(userId)
      }, 15_000)
      socket.data.retryId = retryId
    })

    // ── Leave queue ──────────────────────────────────────────────────────────
    socket.on('battle:leave_queue', () => {
      queue.delete(userId)
      clearInterval(socket.data?.retryId)
      socket.emit('battle:queue_left')
    })

    // ── Create private challenge ─────────────────────────────────────────────
    socket.on('battle:challenge_create', async ({ difficulty } = {}) => {
      if (userToBattle.has(userId))
        return socket.emit('battle:error', { message: 'You are already in a battle.' })

      const user = await User.findById(userId).select('rating name avatar').lean()
      if (!user) return socket.emit('battle:error', { message: 'User not found.' })

      // Remove any previous challenge from this user
      for (const [code, v] of challenges.entries()) {
        if (v.userId === userId) challenges.delete(code)
      }

      const diff = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium'
      const code = genChallengeCode()

      challenges.set(code, {
        socket,
        userId,
        username:  user.name || 'Player',
        avatar:    user.avatar || '',
        rating:    user.rating || 1200,
        difficulty: diff,
        createdAt:  Date.now(),
      })

      // Auto-expire after 10 minutes
      setTimeout(() => {
        if (challenges.has(code)) {
          challenges.delete(code)
          socket.emit('battle:challenge_expired', { challengeCode: code })
        }
      }, 10 * 60 * 1000)

      socket.emit('battle:challenge_created', { challengeCode: code, difficulty: diff })
    })

    // ── Cancel own challenge ─────────────────────────────────────────────────
    socket.on('battle:challenge_cancel', () => {
      for (const [code, v] of challenges.entries()) {
        if (v.userId === userId) { challenges.delete(code); break }
      }
      socket.emit('battle:queue_left')
    })

    // ── Accept a challenge ───────────────────────────────────────────────────
    socket.on('battle:challenge_accept', async ({ challengeCode } = {}) => {
      if (!challengeCode) return socket.emit('battle:error', { message: 'No challenge code provided.' })
      if (userToBattle.has(userId)) return socket.emit('battle:error', { message: 'You are already in a battle.' })

      const code = challengeCode.trim().toUpperCase()
      const challenge = challenges.get(code)
      if (!challenge) return socket.emit('battle:error', { message: 'Challenge not found or expired.' })
      if (challenge.userId === userId) return socket.emit('battle:error', { message: 'You cannot accept your own challenge.' })
      if (!challenge.socket.connected) return socket.emit('battle:error', { message: 'The challenger has disconnected.' })

      challenges.delete(code)

      const user = await User.findById(userId).select('rating name avatar').lean()
      if (!user) return socket.emit('battle:error', { message: 'User not found.' })

      const p2 = {
        socket,
        userId,
        username: user.name || 'Player',
        avatar:   user.avatar || '',
        rating:   user.rating || 1200,
      }
      await createBattle(challenge, p2, challenge.difficulty, true)
    })

    // ── In-battle: submit code for judging ───────────────────────────────────
    socket.on('battle:submit', async ({ battleId, code, language } = {}) => {
      if (!battleId || !code || !language)
        return socket.emit('battle:error', { message: 'Missing battleId, code, or language.' })
      if (submitting.has(userId))
        return socket.emit('battle:error', { message: 'Submission already in progress.' })

      const battle = await Battle.findOne({ battleId, status: 'active' })
      if (!battle) return socket.emit('battle:error', { message: 'Battle not found or not active.' })

      const isP1 = String(battle.player1.userId) === userId
      const isP2 = String(battle.player2.userId) === userId
      if (!isP1 && !isP2) return socket.emit('battle:error', { message: 'Not a participant.' })

      const field = isP1 ? 'player1' : 'player2'
      if (battle[field].solved) return // already solved — ignore further submits

      const LANG_MAP = { cpp: 'cpp', python: 'python', javascript: 'javascript' }
      const langKey = LANG_MAP[language] || 'python'

      // Increment attempt count immediately
      battle[field].attempts  += 1
      battle[field].code       = code
      battle[field].language   = language
      await battle.save()

      // Notify opponent of new attempt
      socket.to(battleId).emit('battle:opponent_attempt', { attempts: battle[field].attempts })

      // Run judge
      submitting.add(userId)
      let result
      try {
        result = await judgeSubmit(userId, battle.problem, code, langKey)
      } catch (err) {
        submitting.delete(userId)
        return socket.emit('battle:judge_result', {
          verdict:      'Error',
          compile_error: 'Judge service error — please try again.',
          attempts:     battle[field].attempts,
        })
      }
      submitting.delete(userId)

      if (!result) {
        return socket.emit('battle:judge_result', {
          verdict:      'Error',
          compile_error: 'No test cases configured for this problem.',
          attempts:     battle[field].attempts,
        })
      }

      const isAC = result.verdict === 'AC' || result.verdict === 'Accepted'

      socket.emit('battle:judge_result', {
        verdict:       result.verdict,
        compile_error: result.compile_error,
        passed_tests:  result.passed_tests,
        total_tests:   result.total_tests,
        time_ms:       result.time_ms,
        attempts:      battle[field].attempts,
      })

      if (isAC) {
        // Re-fetch to avoid stale state race conditions
        const fresh = await Battle.findOne({ battleId, status: 'active' })
        if (!fresh) return

        const solveTimeMs = Date.now() - new Date(fresh.startedAt).getTime()
        fresh[field].solved     = true
        fresh[field].solveTimeMs = solveTimeMs
        await fresh.save()

        socket.emit('battle:you_solved', { solveTimeMs })
        socket.to(battleId).emit('battle:opponent_solved', { solveTimeMs })
        await finishBattle(battleId, userId)
      }
    })

    // ── Forfeit ──────────────────────────────────────────────────────────────
    socket.on('battle:forfeit', async ({ battleId } = {}) => {
      const battle = await Battle.findOne({ battleId, status: 'active' }).lean()
      if (!battle) return
      const isP1 = String(battle.player1.userId) === userId
      const isP2 = String(battle.player2.userId) === userId
      if (!isP1 && !isP2) return

      const winnerId = isP1 ? battle.player2.userId : battle.player1.userId
      socket.to(battleId).emit('battle:opponent_forfeited')
      await finishBattle(battleId, winnerId)
    })

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      userToSocket.delete(userId)
      queue.delete(userId)
      clearInterval(socket.data?.retryId)

      // Remove any pending challenge
      for (const [code, v] of challenges.entries()) {
        if (v.userId === userId) { challenges.delete(code); break }
      }

      // Give 60 s to reconnect before auto-forfeiting
      const battleId = userToBattle.get(userId)
      if (!battleId) return

      socket.to(battleId).emit('battle:opponent_disconnected')

      setTimeout(async () => {
        if (userToSocket.has(userId)) return // reconnected
        const battle = await Battle.findOne({ battleId, status: 'active' }).lean()
        if (!battle) return
        const isP1 = String(battle.player1.userId) === userId
        const winnerId = isP1 ? battle.player2.userId : battle.player1.userId
        await finishBattle(battleId, winnerId)
      }, RECONNECT_GRACE)
    })
  })
}

module.exports = { initBattleSocket }
