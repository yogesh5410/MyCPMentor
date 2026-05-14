/**
 * Problems.jsx
 *
 * Browse all published problems. Clicking a problem opens a detail panel
 * showing the full statement, sample I/O, and constraints.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIFF_COLOR = {
  easy: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  hard: 'text-red-400 bg-red-400/10 border-red-400/20',
}

function Badge({ label, colorClass }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  )
}

// ── Problem list row ──────────────────────────────────────────────────────────

function ProblemRow({ idx, problem, onClick }) {
  const acc =
    problem.totalSubmissions > 0
      ? Math.round((problem.acceptedSubmissions / problem.totalSubmissions) * 100)
      : null

  return (
    <tr
      onClick={onClick}
      className="border-b border-white/5 cursor-pointer transition-colors hover:bg-white/3"
    >
      <td className="px-4 py-3 text-sm text-white/30 w-10">{idx + 1}</td>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-white">{problem.title}</span>
        {problem.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {problem.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/40"
              >
                {t}
              </span>
            ))}
            {problem.tags.length > 3 && (
              <span className="text-[10px] text-white/30">+{problem.tags.length - 3}</span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <Badge
          label={problem.difficulty}
          colorClass={DIFF_COLOR[problem.difficulty] || DIFF_COLOR.medium}
        />
      </td>
      <td className="px-4 py-3 text-sm text-center">
        {acc !== null ? (
          <span
            className={
              acc >= 60 ? 'text-emerald-400' : acc >= 35 ? 'text-yellow-400' : 'text-red-400'
            }
          >
            {acc}%
          </span>
        ) : (
          <span className="text-white/20">—</span>
        )}
      </td>
    </tr>
  )
}

// ── Problem detail panel ──────────────────────────────────────────────────────

// ── Main page ─────────────────────────────────────────────────────────────────

const DIFFICULTIES = ['all', 'easy', 'medium', 'hard']

export default function Problems() {
  const navigate = useNavigate()
  const [problems, setProblems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const fetchProblems = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (difficulty !== 'all') params.set('difficulty', difficulty)
      if (debouncedSearch) params.set('search', debouncedSearch)
      params.set('limit', '100')
      const { data } = await api.get(`/api/problems?${params}`)
      setProblems(data.problems || [])
      setTotal(data.total || 0)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load problems')
    } finally {
      setLoading(false)
    }
  }, [difficulty, debouncedSearch])

  useEffect(() => {
    fetchProblems()
  }, [fetchProblems])

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] min-h-0">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white">Problems</h1>
              <p className="text-sm text-white/50 mt-0.5">
                {loading ? 'Loading…' : `${total} published problem${total !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search problems…"
              className="flex-1 min-w-40 max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60"
            />
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer capitalize ${
                    difficulty === d
                      ? d === 'all'
                        ? 'border-violet-500/60 bg-violet-500/15 text-violet-300'
                        : DIFF_COLOR[d]
                      : 'border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  {d}
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

        {/* Table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-white/30 text-sm">
              Loading…
            </div>
          ) : problems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-white/30 gap-2">
              <span className="text-3xl">📭</span>
              <p className="text-sm">No problems found</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#0d0d1a] z-10">
                <tr className="border-b border-white/8 text-xs text-white/30 uppercase tracking-widest">
                  <th className="px-4 py-2.5 w-10">#</th>
                  <th className="px-4 py-2.5">Title</th>
                  <th className="px-4 py-2.5 text-center">Difficulty</th>
                  <th className="px-4 py-2.5 text-center">Acceptance</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p, i) => (
                  <ProblemRow
                    key={p._id}
                    idx={i}
                    problem={p}
                    onClick={() => navigate(`/dashboard/problems/${p.slug}`)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
    </div>
  )
}
