/**
 * pages/dashboard/admin/AdminProblemReview.jsx
 *
 * Full admin interface for reviewing AI-generated problems.
 *
 * Layout:
 *   Left panel  — paginated queue of problems pending review
 *   Right panel — full detail of the selected problem:
 *                  statement, constraints, solution (cpp), all 12 test cases
 *                  + Publish / Reject actions
 *
 * API:
 *   GET  /api/admin/problems/review            — queue list
 *   GET  /api/admin/problems/review/:id        — full detail
 *   POST /api/admin/problems/review/:id/publish
 *   POST /api/admin/problems/review/:id/reject
 */

import { useState, useEffect, useCallback } from 'react'
import api from '../../../lib/api'

// ─── Difficulty badge ─────────────────────────────────────────────────────────
function DiffBadge({ difficulty }) {
  const s = {
    easy:   'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
    medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
    hard:   'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
  }[difficulty] || 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'

  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${s}`}>
      {difficulty}
    </span>
  )
}

// ─── Code block ───────────────────────────────────────────────────────────────
function CodeBlock({ code, lang = 'cpp' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="relative bg-gray-950 rounded-xl overflow-hidden border border-gray-700/50">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700/50">
        <span className="text-xs text-gray-500 font-mono">{lang}</span>
        <button
          onClick={copy}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors font-medium"
        >
          {copied ? '✅ Copied' : '📋 Copy'}
        </button>
      </div>
      <pre className="text-xs text-gray-200 p-4 overflow-x-auto leading-relaxed font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  )
}

// ─── Test cases table ─────────────────────────────────────────────────────────
function TestCasesTable({ tests, label, color }) {
  const colorMap = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-300',
    gray:   'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-400',
  }

  if (!tests || tests.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No test cases available.</p>
    )
  }

  return (
    <div className="space-y-3">
      {tests.map((tc, i) => (
        <div key={i} className={`rounded-xl border overflow-hidden ${colorMap[color]}`}>
          <div className="px-3 py-1.5 text-xs font-semibold border-b border-current/20">
            {label} #{i + 1}
          </div>
          <div className="grid grid-cols-2 divide-x divide-current/10">
            <div className="p-3">
              <p className="text-xs font-medium mb-1 opacity-70">Input</p>
              <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word">{tc.input || '(empty)'}</pre>
            </div>
            <div className="p-3">
              <p className="text-xs font-medium mb-1 opacity-70">Expected Output</p>
              <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word">{tc.output || '(empty)'}</pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Reject modal ─────────────────────────────────────────────────────────────
function RejectModal({ onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Reject Problem</h3>
          <p className="text-sm text-gray-500 mb-4">Provide a reason so the creator knows what to improve.</p>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="E.g. The solution time complexity is incorrect, or the test cases don't cover edge cases…"
            rows={4}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400/50 resize-none"
          />
          <p className="mt-1 text-xs text-gray-400">{reason.length} / 500</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={() => onConfirm(reason)}
            disabled={reason.trim().length < 5 || loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Rejecting…' : 'Confirm Reject'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function ProblemDetail({ problemId, onReviewed }) {
  const [problem, setProblem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState(null) // { type: 'success'|'error', text }
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    setLoading(true)
    setActionMsg(null)
    api.get(`/api/admin/problems/review/${problemId}`)
      .then(({ data }) => { setProblem(data.problem); setLoading(false) })
      .catch(() => setLoading(false))
  }, [problemId])

  const handlePublish = async () => {
    setActionLoading(true)
    setActionMsg(null)
    try {
      const { data } = await api.post(`/api/admin/problems/review/${problemId}/publish`)
      setActionMsg({
        type: 'success',
        text: `✅ Published! ${data.rewardGranted ? `Creator rewarded ${data.rewardAmount} coins.` : ''}`,
      })
      onReviewed(problemId)
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Publish failed.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (reason) => {
    setActionLoading(true)
    try {
      await api.post(`/api/admin/problems/review/${problemId}/reject`, { reason })
      setActionMsg({ type: 'success', text: '❌ Problem rejected and creator notified.' })
      setShowRejectModal(false)
      onReviewed(problemId)
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Reject failed.' })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-8 h-8 animate-spin text-violet-500 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
          </svg>
          <p className="text-sm text-gray-400">Loading problem…</p>
        </div>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Problem not found.</p>
      </div>
    )
  }

  const isReviewed = problem.status !== 'pending_review'

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">

        {/* Action result message */}
        {actionMsg && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300'
          }`}>
            {actionMsg.text}
          </div>
        )}

        {/* Title + meta */}
        <div>
          <div className="flex items-start gap-3 flex-wrap mb-3">
            <h2 className="text-xl font-black text-gray-900 dark:text-white flex-1 min-w-0">
              {problem.title}
            </h2>
            <DiffBadge difficulty={problem.difficulty} />
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {problem.tags?.map((t) => (
              <span key={t} className="text-xs px-2.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50 font-medium">
                {t}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Time Limit', value: `${problem.timeLimitMs}ms` },
              { label: 'Memory Limit', value: `${problem.memoryLimitMb}MB` },
              { label: 'Optimal Time', value: problem.optimalTimeComplexity },
              { label: 'Optimal Space', value: problem.optimalSpaceComplexity },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                <p className="text-gray-400 mb-0.5">{item.label}</p>
                <p className="font-bold text-gray-800 dark:text-gray-200 font-mono">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Creator info */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 text-sm">
          <span className="text-xl">👤</span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {problem.createdBy?.name || problem.createdBy?.email || 'Unknown'}
            </span>
            <span className="text-gray-400 ml-2">({problem.creatorRole})</span>
          </div>
          <span className="text-gray-400 shrink-0 text-xs">
            {new Date(problem.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* AI Review notes */}
        {problem.requestId?.generations?.review?.notes && (
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5">
              🔍 AI Review Notes
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {problem.requestId.generations.review.notes}
            </p>
            <p className={`mt-1.5 text-xs font-bold ${problem.requestId.generations.review.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              AI verdict: {problem.requestId.generations.review.passed ? '✅ Passed' : '⚠️ Issues detected'}
            </p>
          </div>
        )}

        {/* Description */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Problem Description</h3>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {problem.description}
          </div>
        </div>

        {/* Constraints */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Constraints</h3>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">
            {problem.constraints}
          </div>
        </div>

        {/* C++ Solution */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">C++ Solution</h3>
          <CodeBlock code={problem.solutionCpp} lang="cpp" />
        </div>

        {/* Public test cases (2) */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Public Test Cases ({problem.publicTests?.length || 0})
          </h3>
          <TestCasesTable tests={problem.publicTests} label="Public" color="blue" />
        </div>

        {/* Private test cases (10) */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Private Test Cases ({problem.privateTests?.length || 0})
          </h3>
          <TestCasesTable tests={problem.privateTests} label="Private" color="gray" />
        </div>

        {/* Action buttons */}
        {!isReviewed && (
          <div className="flex gap-3 sticky bottom-0 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm -mx-6 px-6 pt-4 pb-6 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={handlePublish}
              disabled={actionLoading}
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? 'Processing…' : '✅ Publish Problem'}
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ❌ Reject
            </button>
          </div>
        )}

        {isReviewed && (
          <div className="py-4 text-center text-sm font-medium text-gray-400">
            This problem has already been <strong>{problem.status}</strong>.
          </div>
        )}
      </div>

      {showRejectModal && (
        <RejectModal
          onConfirm={handleReject}
          onCancel={() => setShowRejectModal(false)}
          loading={actionLoading}
        />
      )}
    </div>
  )
}

// ─── Queue list item ──────────────────────────────────────────────────────────
function QueueItem({ problem, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors',
        isSelected ? 'bg-violet-50 dark:bg-violet-900/20 border-l-2 border-l-violet-500' : 'border-l-2 border-l-transparent',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{problem.title}</p>
        <DiffBadge difficulty={problem.difficulty} />
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
        <span>{problem.createdBy?.name || problem.createdBy?.email}</span>
        <span>·</span>
        <span>{new Date(problem.createdAt).toLocaleDateString()}</span>
        {problem.tags?.length > 0 && (
          <>
            <span>·</span>
            <span className="text-violet-500 dark:text-violet-400">{problem.tags.slice(0, 2).join(', ')}</span>
          </>
        )}
      </div>
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminProblemReview() {
  const [queue, setQueue]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [page, setPage]           = useState(1)
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedId, setSelectedId] = useState(null)

  const fetchQueue = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/admin/problems/review', {
        params: { page: pg, limit: 15 },
      })
      setQueue(data.problems)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setPage(data.page)
      if (data.problems.length > 0 && !selectedId) {
        setSelectedId(data.problems[0]._id)
      }
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load review queue.')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => { fetchQueue(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleReviewed = (reviewedId) => {
    // Remove from queue locally, select next
    const idx = queue.findIndex((p) => p._id === reviewedId)
    const next = queue[idx + 1] || queue[idx - 1] || null
    setQueue((q) => q.filter((p) => p._id !== reviewedId))
    setTotal((t) => t - 1)
    setSelectedId(next?._id || null)
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: queue list ──────────────────────────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">

        {/* Queue header */}
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white">Review Queue</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40">
              {total} pending
            </span>
          </div>
          <p className="text-xs text-gray-400">Oldest first (FIFO)</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-red-500">{error}</p>
          ) : queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center p-4">
              <span className="text-3xl mb-2">🎉</span>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Queue is empty!</p>
              <p className="text-xs text-gray-400 mt-1">All problems have been reviewed.</p>
            </div>
          ) : (
            <>
              {queue.map((p) => (
                <QueueItem
                  key={p._id}
                  problem={p}
                  isSelected={p._id === selectedId}
                  onClick={() => setSelectedId(p._id)}
                />
              ))}
              {totalPages > 1 && (
                <div className="flex gap-2 p-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => fetchQueue(page - 1)}
                    disabled={page <= 1}
                    className="flex-1 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => fetchQueue(page + 1)}
                    disabled={page >= totalPages}
                    className="flex-1 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right: detail panel ───────────────────────────────────────────── */}
      {selectedId ? (
        <ProblemDetail
          key={selectedId}
          problemId={selectedId}
          onReviewed={handleReviewed}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="text-center p-8">
            <span className="text-5xl">🗄️</span>
            <p className="mt-4 text-lg font-bold text-gray-800 dark:text-white">Select a problem to review</p>
            <p className="mt-1 text-sm text-gray-400">
              Choose from the queue on the left to view full details and take action.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
