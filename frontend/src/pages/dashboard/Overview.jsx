import { Link } from 'react-router-dom'

// Dashboard Overview — home page after login.
// All data here is placeholder; will be replaced with real API calls
// as each feature section is built out.

const stats = [
  { label: 'Problems Solved', value: '342', delta: '+12 this week', color: 'violet', icon: '✅' },
  { label: 'Current Rating', value: '1547', delta: '+23 from last contest', color: 'blue', icon: '⭐' },
  { label: 'Day Streak', value: '12', delta: '🔥 Keep it up!', color: 'orange', icon: '🔥' },
  { label: 'Battles Won', value: '28', delta: '28 / 36 total (78%)', color: 'emerald', icon: '⚔️' },
]

const colorMap = {
  violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40 text-violet-600 dark:text-violet-400',
  blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400',
  orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40 text-orange-600 dark:text-orange-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400',
}

const recentActivity = [
  { problem: 'Codeforces 1900D - Maximize...', verdict: 'AC', time: '2h ago', rating: 1900, lang: 'C++' },
  { problem: 'Codeforces 1700B - Reverse...', verdict: 'WA', time: '5h ago', rating: 1700, lang: 'C++' },
  { problem: 'Codeforces 1700B - Reverse...', verdict: 'AC', time: '5h ago', rating: 1700, lang: 'C++' },
  { problem: 'AI Generated: Tree DP', verdict: 'AC', time: '1d ago', rating: 1800, lang: 'Python' },
  { problem: 'Codeforces 1600C - Dijkstra...', verdict: 'TLE', time: '1d ago', rating: 1600, lang: 'C++' },
]

const verdictStyle = {
  AC: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  WA: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  TLE: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  MLE: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
}

const revisionDue = [
  { name: 'Graph BFS Levels (CF 1700)', topic: 'Graphs', due: 'Now' },
  { name: 'Segment Tree Range Query', topic: 'Data Structures', due: 'Now' },
  { name: 'DP on Trees — LCA', topic: 'DP', due: 'In 2h' },
]

const quickNav = [
  { to: '/dashboard/potd', label: "Today's POTD", desc: 'Solve the daily challenge', icon: '📅', color: 'bg-blue-500' },
  { to: '/dashboard/practice', label: 'Practice', desc: 'Drill your weak topics', icon: '⚡', color: 'bg-violet-500' },
  { to: '/dashboard/battles', label: 'Quick Battle', desc: 'Find a 1v1 opponent now', icon: '⚔️', color: 'bg-red-500' },
  { to: '/dashboard/revision', label: 'Start Revision', desc: '3 problems due today', icon: '🔄', color: 'bg-emerald-500' },
]

// Simple heatmap — 7 weeks × 7 days (placeholder intensity)
function ActivityHeatmap() {
  const seed = [0, 1, 2, 3, 4, 2, 1, 0, 3, 2, 4, 1, 0, 2, 3, 4, 2, 0, 1, 3, 2, 4, 0, 1, 2, 3, 4, 2, 1, 0, 3, 2, 4, 1, 0, 2, 3, 4, 2, 0, 1, 3, 2, 4, 0, 1, 2, 3, 1]
  const intensity = ['bg-gray-100 dark:bg-gray-800', 'bg-violet-200 dark:bg-violet-900/60', 'bg-violet-300 dark:bg-violet-700/70', 'bg-violet-500 dark:bg-violet-600', 'bg-violet-700 dark:bg-violet-500']

  return (
    <div className="flex gap-1 flex-wrap">
      {seed.map((v, i) => (
        <div key={i} className={`w-3 h-3 rounded-sm ${intensity[v]}`} title={`${v} submissions`} />
      ))}
    </div>
  )
}

export default function Overview() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto space-y-6">

      {/* ── Welcome banner ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {greeting}, User 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' — '}Your streak is on fire! Keep solving.
          </p>
        </div>
        <Link
          to="/dashboard/potd"
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
        >
          <span>📅</span> Solve Today's POTD
        </Link>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${colorMap[s.color]}`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{s.value}</div>
            <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">{s.label}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.delta}</div>
          </div>
        ))}
      </div>

      {/* ── Quick nav cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickNav.map(q => (
          <Link
            key={q.to}
            to={q.to}
            className="group flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-md hover:shadow-violet-500/5 transition-all"
          >
            <div className={`${q.color} w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0`}>
              {q.icon}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{q.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">{q.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── POTD + Revision row ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* POTD preview */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>📅</span> Problem of the Day
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">April 14, 2026</span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">
                CF 2100A — Graph Coloring with Constraints
              </h3>
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium">
                2100
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>🏷 Graphs, DFS</span>
              <span>⏱ 2s TL</span>
              <span>💾 256MB</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/dashboard/potd" className="flex-1 text-center bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
              Solve Now →
            </Link>
            <button className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-violet-400 dark:hover:border-violet-600 transition-colors">
              Hint 💡
            </button>
          </div>
        </div>

        {/* Revision queue */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>🔄</span> Revision Due
              <span className="bg-violet-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{revisionDue.length}</span>
            </h2>
            <Link to="/dashboard/revision" className="text-xs text-violet-600 dark:text-violet-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {revisionDue.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 group hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors cursor-pointer">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{r.topic}</div>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${r.due === 'Now' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'}`}>
                  {r.due}
                </span>
              </div>
            ))}
          </div>
          <Link to="/dashboard/revision" className="mt-3 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            Start Revision Session →
          </Link>
        </div>
      </div>

      {/* ── Activity Heatmap + Recent Activity ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Heatmap */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">📊 Activity (past 7 weeks)</h2>
          <ActivityHeatmap />
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">Each cell = one day. Darker = more submissions.</p>
        </div>

        {/* Recent submissions */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white">🕐 Recent Submissions</h2>
            <Link to="/dashboard/problems" className="text-xs text-violet-600 dark:text-violet-400 hover:underline">All</Link>
          </div>
          <div className="space-y-2">
            {recentActivity.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${verdictStyle[s.verdict] || 'bg-gray-100 text-gray-600'}`}>
                  {s.verdict}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">{s.problem}</span>
                <span className="text-xs text-gray-400 dark:text-gray-600 shrink-0">{s.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
