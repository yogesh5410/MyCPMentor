/**
 * pages/dashboard/MyRequests.jsx
 *
 * Lets users (and admins) see all their AI problem-creation requests
 * with live status. Active jobs (queued/processing) auto-refresh every 5s.
 *
 * API:
 *   GET /api/problems/requests   — paginated list
 *   GET /api/problems/request/:id — status detail (used for live-poll)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  queued:     'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/40',
  processing: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/40',
  completed:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/40',
  failed:     'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/40',
}

const STATUS_ICONS = {
  queued: '⏳', processing: '⚙️', completed: '✅', failed: '❌',
}

const STAGE_LABELS = {
  idle: 'Waiting in queue',
  statement: 'Writing problem statement',
  solution: 'Writing C++ solution',
  test_scripts: 'Building test case scripts',
  test_execution: 'Running test cases',
  review: 'AI review in progress',
  done: 'All stages complete',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLES[status] || ''}`}>
      {STATUS_ICONS[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Single request card ──────────────────────────────────────────────────────
function RequestCard({ request, onRefreshed }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail]     = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchDetail = async () => {
    if (detail) { setExpanded(true); return }
    setLoadingDetail(true)
    try {
      const { data } = await api.get(`/api/problems/request/${request._id}`)
      setDetail(data.request)
      setExpanded(true)
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false)
    }
  }

  const isActive = request.status === 'queued' || request.status === 'processing'

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">

      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-2">
              {request.prompt}
            </p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400">
          <span>🕐 {new Date(request.createdAt).toLocaleString()}</span>
          {request.coinsDeducted > 0 && (
            <span>🪙 {request.coinsDeducted} coins</span>
          )}
          {isActive && request.currentStage && (
            <span className="text-violet-500 dark:text-violet-400 font-medium animate-pulse">
              {STAGE_LABELS[request.currentStage] || request.currentStage}
            </span>
          )}
          {request.status === 'failed' && request.errorMessage && (
            <span className="text-red-500 truncate max-w-xs">{request.errorMessage}</span>
          )}
        </div>
      </div>

      {/* Expand button for completed requests */}
      {request.status === 'completed' && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={fetchDetail}
            disabled={loadingDetail}
            className="w-full py-2.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-colors"
          >
            {loadingDetail ? 'Loading…' : expanded ? '▲ Hide details' : '▼ View generated problem'}
          </button>

          {expanded && detail && (
            <ProblemPreview request={detail} onClose={() => setExpanded(false)} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Problem preview panel (for completed requests) ───────────────────────────
function ProblemPreview({ request }) {
  const stmt = request?.generations?.statement || {}

  if (!stmt.title) {
    return (
      <div className="px-5 pb-5 text-sm text-gray-400">
        Problem details not available yet.
      </div>
    )
  }

  return (
    <div className="px-5 pb-5 mt-2 space-y-4">
      {/* Title & meta */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2">{stmt.title}</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {stmt.difficulty && (
            <span className={`px-2.5 py-0.5 rounded-full font-semibold border ${
              stmt.difficulty === 'easy' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700' :
              stmt.difficulty === 'hard' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700' :
              'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700'
            }`}>
              {stmt.difficulty}
            </span>
          )}
          {stmt.tags?.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50 font-medium">
              {t}
            </span>
          ))}
          {stmt.timeLimitMs && <span className="text-gray-500">⏱ {stmt.timeLimitMs}ms</span>}
          {stmt.memoryLimitMb && <span className="text-gray-500">💾 {stmt.memoryLimitMb}MB</span>}
          {stmt.optimalTimeComplexity && <span className="text-gray-500">T: {stmt.optimalTimeComplexity}</span>}
          {stmt.optimalSpaceComplexity && <span className="text-gray-500">S: {stmt.optimalSpaceComplexity}</span>}
        </div>
      </div>

      {/* Description */}
      {stmt.description && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {stmt.description}
          </p>
        </div>
      )}

      {/* Constraints */}
      {stmt.constraints && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Constraints</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">
            {stmt.constraints}
          </p>
        </div>
      )}

      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2">
        ⏳ Pending admin review — you'll earn 1,000 coins when it's published!
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-16">
      <span className="text-5xl">🤖</span>
      <p className="mt-4 text-lg font-bold text-gray-800 dark:text-white">No requests yet</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Create your first AI-generated problem to see it here.
      </p>
      <Link
        to="/dashboard/create-problem"
        className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors"
      >
        ✨ Create a Problem
      </Link>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MyRequests() {
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pollRef = useRef(null)

  const fetchRequests = useCallback(async (pg = 1, silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data } = await api.get('/api/problems/requests', {
        params: { page: pg, limit: 10 },
      })
      setRequests(data.requests)
      setTotalPages(data.totalPages)
      setPage(data.page)
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load requests.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => { fetchRequests(1) }, [fetchRequests])

  // Auto-refresh every 5s if any active jobs exist
  useEffect(() => {
    const hasActive = requests.some((r) => r.status === 'queued' || r.status === 'processing')
    if (hasActive) {
      pollRef.current = setInterval(() => fetchRequests(page, true), 5000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [requests, page, fetchRequests])

  const counts = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">My Problem Requests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Track your AI problem-generation jobs
          </p>
        </div>
        <Link
          to="/dashboard/create-problem"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors shrink-0"
        >
          ✨ New
        </Link>
      </div>

      {/* Status summary */}
      {requests.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(counts).map(([status, count]) => (
            <div key={status} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUS_STYLES[status]}`}>
              {STATUS_ICONS[status]} {count} {status}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard key={r._id} request={r} onRefreshed={() => fetchRequests(page, true)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => fetchRequests(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => fetchRequests(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
