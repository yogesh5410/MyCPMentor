/**
 * AdminProblemReview.jsx
 *
 * Admin queue for reviewing AI-generated problems that are in `pending_review`
 * status. Admin can read the full problem statement, inspect test cases, then
 * Approve (→ published) or Reject with a reason.
 */

import { useState, useEffect, useCallback } from 'react'
import api from '../../../lib/api'

// ── Helpers ──────────────────────────────────────────────────────────────────

const DIFF_COLOR = {
  easy: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  hard: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const STATUS_COLOR = {
  pending_review: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  published: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const STATUS_LABEL = {
  pending_review: '⏳ Pending',
  published: '✅ Published',
  rejected: '❌ Rejected',
}

function Badge({ label, colorClass }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  )
}

function ProblemRow({ problem, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg border transition-all cursor-pointer ${
        selected
          ? 'border-violet-500/60 bg-violet-500/10'
          : 'border-white/8 bg-white/3 hover:bg-white/6'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{problem.title}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {new Date(problem.createdAt).toLocaleDateString()}
            {problem.aiJobId && (
              <span className="ml-2 text-violet-400">AI-generated</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge
            label={problem.difficulty}
            colorClass={DIFF_COLOR[problem.difficulty] || DIFF_COLOR.medium}
          />
          <Badge
            label={STATUS_LABEL[problem.status] || problem.status}
            colorClass={STATUS_COLOR[problem.status] || 'text-white/60 border-white/20'}
          />
        </div>
      </div>
      {problem.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {problem.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/50"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

function SectionHeading({ children }) {
  return (
    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
      {children}
    </h3>
  )
}

function CodeBlock({ code }) {
  return (
    <pre className="bg-black/40 border border-white/8 rounded-lg p-3 text-xs font-mono text-green-300 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
      {code || '(empty)'}
    </pre>
  )
}

function ProblemDetail({ problemId, onApprove, onReject }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('statement')
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!problemId) return
    setLoading(true)
    setActionError('')
    api
      .get(`/api/admin/ai-problems/${problemId}`)
      .then((r) => setDetail(r.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [problemId])

  const handleApprove = async () => {
    setActionLoading(true)
    setActionError('')
    try {
      await api.post(`/api/admin/ai-problems/${problemId}/approve`)
      onApprove(problemId)
    } catch (e) {
      setActionError(e.response?.data?.error || 'Approval failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    setActionLoading(true)
    setActionError('')
    try {
      await api.post(`/api/admin/ai-problems/${problemId}/reject`, { reason: rejectReason })
      setRejectModal(false)
      onReject(problemId)
    } catch (e) {
      setActionError(e.response?.data?.error || 'Rejection failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/40">
        Loading problem…
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Failed to load problem detail
      </div>
    )
  }

  const tabs = [
    { id: 'statement', label: 'Statement' },
    { id: 'samples', label: 'Samples' },
    { id: 'solution', label: 'Solution' },
    { id: 'tests', label: `Tests (${(detail.publicTests?.length || 0) + (detail.privateTests?.length || 0)})` },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-4 border-b border-white/8">
        <div>
          <h2 className="text-lg font-semibold text-white">{detail.title}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge
              label={detail.difficulty}
              colorClass={DIFF_COLOR[detail.difficulty] || DIFF_COLOR.medium}
            />
            <Badge
              label={STATUS_LABEL[detail.status] || detail.status}
              colorClass={STATUS_COLOR[detail.status] || 'text-white/60 border-white/20'}
            />
            {detail.tags?.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/50 border border-white/10"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Actions — only for pending_review */}
        {detail.status === 'pending_review' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setRejectModal(true)}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
            >
              {actionLoading ? 'Publishing…' : '✅ Approve & Publish'}
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {actionError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/8 px-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
              tab === t.id
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {tab === 'statement' && (
          <>
            <div>
              <SectionHeading>Problem Statement</SectionHeading>
              <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {detail.description}
              </div>
            </div>
            {detail.constraints && (
              <div>
                <SectionHeading>Constraints</SectionHeading>
                <div className="text-sm text-white/70 whitespace-pre-wrap bg-white/3 rounded-lg p-3 border border-white/8">
                  {detail.constraints}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Time Limit', `${detail.timeLimitMs} ms`],
                ['Memory Limit', `${detail.memoryLimitMb} MB`],
                ['Optimal Time', detail.optimalTimeComplexity],
                ['Optimal Space', detail.optimalSpaceComplexity],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="bg-white/3 border border-white/8 rounded-lg p-3"
                >
                  <p className="text-xs text-white/40">{label}</p>
                  <p className="text-sm text-white font-mono">{value}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'samples' && (
          <>
            {detail.inputFormat && (
              <div>
                <SectionHeading>Input Format</SectionHeading>
                <div className="text-sm text-white/70 whitespace-pre-wrap">{detail.inputFormat}</div>
              </div>
            )}
            {detail.outputFormat && (
              <div>
                <SectionHeading>Output Format</SectionHeading>
                <div className="text-sm text-white/70 whitespace-pre-wrap">{detail.outputFormat}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <SectionHeading>Sample Input</SectionHeading>
                <CodeBlock code={detail.sampleInput} />
              </div>
              <div>
                <SectionHeading>Sample Output</SectionHeading>
                <CodeBlock code={detail.sampleOutput} />
              </div>
            </div>
            {detail.sampleExplanation && (
              <div>
                <SectionHeading>Explanation</SectionHeading>
                <div className="text-sm text-white/70 whitespace-pre-wrap bg-white/3 rounded-lg p-3 border border-white/8">
                  {detail.sampleExplanation}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'solution' && (
          <div>
            <SectionHeading>Reference Solution (C++ / Python)</SectionHeading>
            <CodeBlock code={detail.solutionCpp} />
          </div>
        )}

        {tab === 'tests' && (
          <div className="space-y-4">
            {detail.publicTests?.length > 0 && (
              <div>
                <SectionHeading>Public Test Cases ({detail.publicTests.length})</SectionHeading>
                {detail.publicTests.map((tc, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-white/40 mb-1">Input #{i + 1}</p>
                      <CodeBlock code={tc.input} />
                    </div>
                    <div>
                      <p className="text-xs text-white/40 mb-1">Output #{i + 1}</p>
                      <CodeBlock code={tc.output} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {detail.privateTests?.length > 0 && (
              <div>
                <SectionHeading>Private Test Cases ({detail.privateTests.length})</SectionHeading>
                {detail.privateTests.map((tc, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-white/40 mb-1">Input #{i + 1}</p>
                      <CodeBlock code={tc.input} />
                    </div>
                    <div>
                      <p className="text-xs text-white/40 mb-1">Output #{i + 1}</p>
                      <CodeBlock code={tc.output} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-1">Reject Problem</h3>
            <p className="text-sm text-white/50 mb-4">
              Provide a reason (optional) — this helps improve future generations.
            </p>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-violet-500/60 h-24"
              placeholder="e.g. Duplicate problem, unclear statement, wrong difficulty…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm border border-white/10 text-white/60 hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
              >
                {actionLoading ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminProblemReview() {
  const [problems, setProblems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('pending_review')

  const fetchList = useCallback(async (status) => {
    setLoading(true)
    setError('')
    try {
      const params = status ? `?status=${status}` : ''
      const { data } = await api.get(`/api/admin/ai-problems${params}`)
      setProblems(data.problems || [])
      setTotal(data.total || 0)
      if (data.problems?.length > 0) {
        setSelectedId((prev) => prev || data.problems[0]._id)
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load problems')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList(statusFilter)
  }, [statusFilter, fetchList])

  const handleApprove = (id) => {
    setProblems((prev) =>
      prev.map((p) => (p._id === id ? { ...p, status: 'published' } : p))
    )
  }

  const handleReject = (id) => {
    setProblems((prev) =>
      prev.map((p) => (p._id === id ? { ...p, status: 'rejected' } : p))
    )
  }

  const filterButtons = [
    { value: 'pending_review', label: '⏳ Pending' },
    { value: 'published', label: '✅ Published' },
    { value: 'rejected', label: '❌ Rejected' },
    { value: '', label: '🔍 All' },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] min-h-0">
      {/* Page header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Problem Review Queue</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Review AI-generated problems before publishing to the platform
            </p>
          </div>
          <div className="flex gap-2">
            {filterButtons.map((fb) => (
              <button
                key={fb.value}
                onClick={() => {
                  setStatusFilter(fb.value)
                  setSelectedId(null)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  statusFilter === fb.value
                    ? 'border-violet-500/60 bg-violet-500/15 text-violet-300'
                    : 'border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                {fb.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: problem list */}
        <div className="w-72 shrink-0 border-r border-white/8 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs text-white/40">
              {loading ? 'Loading…' : `${total} problem${total !== 1 ? 's' : ''}`}
            </span>
            <button
              onClick={() => fetchList(statusFilter)}
              className="text-xs text-white/40 hover:text-violet-400 transition-colors cursor-pointer"
            >
              ↻ Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {loading ? (
              <div className="text-center text-white/30 text-sm pt-8">Loading…</div>
            ) : problems.length === 0 ? (
              <div className="text-center text-white/30 text-sm pt-8">
                No problems in this queue
              </div>
            ) : (
              problems.map((p) => (
                <ProblemRow
                  key={p._id}
                  problem={p}
                  selected={selectedId === p._id}
                  onClick={() => setSelectedId(p._id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {selectedId ? (
            <ProblemDetail
              key={selectedId}
              problemId={selectedId}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2">
              <span className="text-4xl">🔍</span>
              <p className="text-sm">Select a problem to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
