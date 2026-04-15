/**
 * pages/dashboard/CreateProblem.jsx
 *
 * ChatGPT-like interface for submitting an AI problem-creation request.
 *
 * Flow:
 *   1. User describes their problem idea in a textarea
 *   2. Submit → POST /api/problems/request  (deducts 200 coins)
 *   3. Page transitions to a live progress-tracking view (polls every 3s)
 *   4. On completion  → success card with problem title + "pending review" note
 *   5. On failure     → error card, coins refunded automatically by backend
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

// ─── Stage metadata ──────────────────────────────────────────────────────────
const STAGES = [
  { key: 'statement',      label: 'Generating problem statement',  icon: '📝' },
  { key: 'solution',       label: 'Writing C++ solution',          icon: '💻' },
  { key: 'test_scripts',   label: 'Creating test case scripts',    icon: '🧪' },
  { key: 'test_execution', label: 'Running test cases',            icon: '⚙️'  },
  { key: 'review',         label: 'Final AI review',               icon: '🔍' },
  { key: 'done',           label: 'Complete!',                     icon: '✅' },
]

function stageIndex(key) {
  return STAGES.findIndex((s) => s.key === key)
}

// ─── Stage progress bar ───────────────────────────────────────────────────────
function PipelineTracker({ currentStage, status }) {
  const current = stageIndex(currentStage)

  return (
    <div className="space-y-2.5 mt-4">
      {STAGES.map((stage, i) => {
        const isDone    = status === 'completed' || i < current
        const isActive  = i === current && status === 'processing'
        const isPending = !isDone && !isActive

        return (
          <div
            key={stage.key}
            className={[
              'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-300',
              isDone   ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300' : '',
              isActive ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700/50 text-violet-700 dark:text-violet-300 animate-pulse' : '',
              isPending ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 text-gray-400 dark:text-gray-600' : '',
            ].join(' ')}
          >
            <span className="text-base shrink-0">
              {isDone ? '✅' : isActive ? '⏳' : '⬜'}
            </span>
            <span>{stage.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tips card ────────────────────────────────────────────────────────────────
const TIPS = [
  'Mention the algorithm or data structure (e.g. "segment tree with lazy propagation")',
  'Specify a difficulty hint: easy / medium / hard',
  'Describe the problem domain (trees, graphs, strings, DP…)',
  'Include any special constraint requirements (e.g. "n up to 1e6, O(n log n) expected")',
]

function TipsCard() {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-4 mb-6">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2.5">
        💡 Tips for a great problem
      </p>
      <ul className="space-y-1.5">
        {TIPS.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
            <span className="text-blue-400 shrink-0 mt-0.5">•</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CreateProblem() {
  const { user, updateCoins } = useAuth()

  // Form state
  const [prompt, setPrompt]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')

  // Tracking state (after submission)
  const [requestId, setRequestId]   = useState(null)
  const [request, setRequest]       = useState(null)   // latest polled data
  const [pollError, setPollError]   = useState('')

  const pollRef = useRef(null)

  const COST = 200
  const hasEnoughCoins = !user || user.role === 'admin' || (user.coins ?? 0) >= COST

  // ── Submit form ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!prompt.trim() || prompt.trim().length < 20) {
      setFormError('Please describe your idea in at least 20 characters.')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      const { data } = await api.post('/api/problems/request', { prompt: prompt.trim() })
      // Deduct coins optimistically in context so the header updates immediately
      if (data.coinsRemaining !== undefined) updateCoins(data.coinsRemaining)
      setRequestId(data.requestId)
      setRequest({ status: 'queued', currentStage: 'idle', prompt: prompt.trim() })
    } catch (err) {
      setFormError(
        err.response?.data?.error || 'Failed to submit. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Poll request status ──────────────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    if (!requestId) return
    try {
      const { data } = await api.get(`/api/problems/request/${requestId}`)
      setRequest(data.request)
      // Update coin balance if refund happened (failed status)
      if (data.request.status === 'failed') {
        // Re-fetch user coins via refreshUser is cleaner, but calling /api/problems/coins is fine
        api.get('/api/problems/coins').then(({ data: cd }) => updateCoins(cd.coins)).catch(() => {})
      }
    } catch {
      setPollError('Could not fetch job status. Will retry...')
    }
  }, [requestId, updateCoins])

  // Start / stop polling based on request state
  useEffect(() => {
    if (!requestId) return
    // Immediate first fetch
    pollStatus()
    // Poll every 3 seconds while active
    pollRef.current = setInterval(pollStatus, 3000)
    return () => clearInterval(pollRef.current)
  }, [requestId, pollStatus])

  // Stop polling when terminal state reached
  useEffect(() => {
    if (request?.status === 'completed' || request?.status === 'failed') {
      clearInterval(pollRef.current)
      // Refresh coins on completion to reflect any reward state
      api.get('/api/problems/coins').then(({ data }) => updateCoins(data.coins)).catch(() => {})
    }
  }, [request?.status, updateCoins])

  const resetForm = () => {
    setPrompt('')
    setRequestId(null)
    setRequest(null)
    setPollError('')
    setFormError('')
  }

  // ── Render: tracking view ────────────────────────────────────────────────────
  if (requestId && request) {
    const isCompleted = request.status === 'completed'
    const isFailed    = request.status === 'failed'
    const isActive    = !isCompleted && !isFailed

    return (
      <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800/50 shrink-0">
            🤖
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">
              {isCompleted ? 'Problem Generated!' : isFailed ? 'Generation Failed' : 'Generating your problem…'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isCompleted
                ? 'Your problem is pending admin review before it goes live.'
                : isFailed
                ? 'An error occurred. Your coins have been refunded.'
                : 'The AI pipeline is running. This usually takes 30–90 seconds.'}
            </p>
          </div>
        </div>

        {/* Prompt preview */}
        <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-2xl p-4 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Your idea</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-4">
            {request.prompt}
          </p>
        </div>

        {/* Success card */}
        {isCompleted && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🎉</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                Problem generated successfully
              </span>
            </div>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-4">
              An admin will review the problem statement, solution, and test cases before publishing it to the platform. You'll earn <strong>1,000 coins</strong> when it's published!
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/dashboard/my-requests"
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                View My Requests →
              </Link>
              <button
                onClick={resetForm}
                className="text-sm font-medium px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        )}

        {/* Failure card */}
        {isFailed && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">❌</span>
              <span className="font-bold text-red-700 dark:text-red-300">Generation failed</span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-400 mb-1">
              {request.errorMessage || 'An unexpected error occurred during AI generation.'}
            </p>
            {request.coinsDeducted > 0 && (
              <p className="text-sm font-semibold text-red-600 dark:text-red-300 mb-4">
                🪙 {request.coinsDeducted} coins have been refunded to your account.
              </p>
            )}
            <button
              onClick={resetForm}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Pipeline tracker */}
        {(isActive || isCompleted) && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">AI Pipeline Progress</p>
            {isActive && (
              <p className="text-xs text-gray-400 mb-3">Updates every 3 seconds</p>
            )}
            <PipelineTracker currentStage={request.currentStage || 'idle'} status={request.status} />
          </div>
        )}

        {pollError && (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">{pollError}</p>
        )}
      </div>
    )
  }

  // ── Render: form view ────────────────────────────────────────────────────────
  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800/50 shrink-0">
            🤖
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Create a Problem with AI</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Describe your idea — AI generates the full problem, solution, and test cases
            </p>
          </div>
        </div>

        {/* Coin balance */}
        {user && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 shrink-0">
            <span className="text-base">🪙</span>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
              {(user.coins ?? 0).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Link to My Requests */}
      <div className="flex justify-end mb-4">
        <Link
          to="/dashboard/my-requests"
          className="text-sm text-violet-600 dark:text-violet-400 hover:underline font-medium"
        >
          View my requests →
        </Link>
      </div>

      <TipsCard />

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-5">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Your Problem Idea
          </label>
          <textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setFormError('') }}
            placeholder="Describe the competitive programming problem you want to create…&#10;&#10;Example: Create a medium-difficulty problem involving segment trees with lazy propagation. The problem should involve a sequence of range-update and range-query operations on an array of size up to 1e5. Expected solution is O(n log n)."
            rows={8}
            maxLength={5000}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-400 dark:focus:border-violet-500 resize-none transition-colors"
          />
          <div className="flex justify-between items-center mt-2">
            <span className={`text-xs ${prompt.length > 4500 ? 'text-red-500' : 'text-gray-400'}`}>
              {prompt.length} / 5000
            </span>
            <span className="text-xs text-gray-400">Min. 20 characters</span>
          </div>
        </div>

        {/* Cost info */}
        {user?.role !== 'admin' && (
          <div className={[
            'flex items-center gap-3 px-4 py-3 rounded-xl border mb-5 text-sm',
            hasEnoughCoins
              ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400'
              : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400',
          ].join(' ')}>
            <span className="text-base shrink-0">🪙</span>
            <div>
              <span className="font-semibold">Cost: {COST} coins</span>
              {' — '}
              {hasEnoughCoins
                ? `You have ${(user?.coins ?? 0).toLocaleString()} coins. After: ${((user?.coins ?? 0) - COST).toLocaleString()}`
                : `You only have ${(user?.coins ?? 0).toLocaleString()} coins. You need ${COST - (user?.coins ?? 0)} more.`}
            </div>
          </div>
        )}

        {user?.role === 'admin' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-900/10 text-sm text-violet-700 dark:text-violet-400 mb-5">
            <span>⚡</span>
            <span className="font-medium">Admin: problem creation is free for you.</span>
          </div>
        )}

        {formError && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-2.5">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !hasEnoughCoins}
          className={[
            'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all duration-150',
            submitting || !hasEnoughCoins
              ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              : 'bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white shadow-sm shadow-violet-500/25',
          ].join(' ')}
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
              Queuing…
            </>
          ) : (
            <>
              <span>✨</span>
              {user?.role === 'admin' ? 'Generate Problem (Free)' : `Generate Problem — ${COST} coins`}
            </>
          )}
        </button>
      </form>
    </div>
  )
}
