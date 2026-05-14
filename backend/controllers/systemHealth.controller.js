/**
 * controllers/systemHealth.controller.js
 *
 * Aggregates health/metrics from:
 *  - judge-service  (judge metrics, Celery workers, Redis stats)
 *  - backend itself (MongoDB connection, process uptime, memory)
 *
 * GET /api/admin/system-health
 */

const mongoose = require('mongoose')

const JUDGE_URL = process.env.JUDGE_SERVICE_URL || 'http://localhost:8001'
const AI_URL    = process.env.AI_SERVICE_URL    || 'http://localhost:8002'

// ── Lightweight fetch helper ──────────────────────────────────────────────────
async function fetchJSON(url, timeoutMs = 4000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(id)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { ok: true, data: await res.json() }
  } catch (err) {
    clearTimeout(id)
    return { ok: false, error: err.message }
  }
}

// ── MongoDB stats ─────────────────────────────────────────────────────────────
async function getMongoStats() {
  try {
    const state = mongoose.connection.readyState
    // 0=disconnected 1=connected 2=connecting 3=disconnecting
    const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }
    const db = mongoose.connection.db

    let serverStatus = {}
    if (state === 1 && db) {
      try {
        serverStatus = await db.command({ serverStatus: 1 })
      } catch (_) {
        // not all MongoDB tiers allow serverStatus
      }
    }

    const connections = serverStatus?.connections || {}
    const opcounters  = serverStatus?.opcounters  || {}
    const mem         = serverStatus?.mem          || {}

    return {
      status:             stateMap[state] || 'unknown',
      current_connections: connections.current  || 0,
      available_connections: connections.available || 0,
      ops_insert:  opcounters.insert || 0,
      ops_query:   opcounters.query  || 0,
      ops_update:  opcounters.update || 0,
      ops_delete:  opcounters.delete || 0,
      resident_mb: mem.resident || 0,
      virtual_mb:  mem.virtual  || 0,
    }
  } catch (err) {
    return { status: 'error', error: err.message }
  }
}

// ── Node.js process stats ─────────────────────────────────────────────────────
function getProcessStats() {
  const mu = process.memoryUsage()
  return {
    uptime_seconds:   Math.floor(process.uptime()),
    uptime_human:     formatUptime(process.uptime()),
    node_version:     process.version,
    pid:              process.pid,
    heap_used_mb:     +(mu.heapUsed  / 1_048_576).toFixed(2),
    heap_total_mb:    +(mu.heapTotal / 1_048_576).toFixed(2),
    rss_mb:           +(mu.rss       / 1_048_576).toFixed(2),
    external_mb:      +(mu.external  / 1_048_576).toFixed(2),
  }
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

// ── Main handler ──────────────────────────────────────────────────────────────
const getSystemHealth = async (_req, res) => {
  const now = Date.now()

  // Fetch judge-service in parallel with local stats
  // monitoring endpoint is slow (Celery worker inspect ~5-6s) → 15s timeout
  const [judgeMonitor, judgeHealth, aiHealth, mongo, proc] = await Promise.all([
    fetchJSON(`${JUDGE_URL}/api/judge/monitoring`, 15000),
    fetchJSON(`${JUDGE_URL}/api/judge/health`,     5000),
    fetchJSON(`${AI_URL}/api/ai/health`,            4000),
    getMongoStats(),
    Promise.resolve(getProcessStats()),
  ])

  const judgeOk = judgeHealth.ok && judgeHealth.data?.status === 'ok'
  const aiOk    = aiHealth.ok    && aiHealth.data?.status    === 'ok'

  // Service status panel
  const services = [
    {
      name:    'Backend API',
      status:  'online',
      latency_ms: 0,
      url:     `http://localhost:${process.env.PORT || 5000}`,
    },
    {
      name:    'Judge Service',
      status:  judgeOk ? 'online' : 'degraded',
      latency_ms: null,
      url:     JUDGE_URL,
    },
    {
      name:    'AI Problem Service',
      status:  aiOk ? 'online' : 'degraded',
      latency_ms: null,
      url:     AI_URL,
    },
    {
      name:    'MongoDB',
      status:  mongo.status === 'connected' ? 'online' : 'degraded',
      latency_ms: null,
    },
    {
      name:    'Redis (via Judge)',
      status:  judgeMonitor.data?.redis_ok ? 'online' : 'degraded',
      latency_ms: null,
    },
  ]

  res.json({
    timestamp:    new Date().toISOString(),
    response_ms:  Date.now() - now,
    services,
    judge:  judgeMonitor.ok ? judgeMonitor.data  : { status: 'unavailable' },
    ai:     aiHealth.ok     ? aiHealth.data       : { status: 'unavailable' },
    mongo,
    process: proc,
  })
}

module.exports = { getSystemHealth }
