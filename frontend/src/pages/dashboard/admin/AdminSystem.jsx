import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import api from '../../../lib/api'

// ── Colour palette ─────────────────────────────────────────────────────────
const VERDICT_COLORS = {
  AC: '#22c55e', WA: '#ef4444', TLE: '#f97316',
  MLE: '#a855f7', RE: '#06b6d4', CE: '#eab308',
}
const LANG_COLORS = { python: '#3b82f6', cpp: '#8b5cf6', javascript: '#f59e0b' }
const STATUS_COLORS = { online: '#22c55e', degraded: '#f97316', unavailable: '#ef4444' }

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString())
const ms  = (n) => (n == null ? '—' : `${n} ms`)
const mb  = (n) => (n == null ? '—' : `${n} MB`)

function StatCard({ label, value, sub, accent = 'blue' }) {
  const ringMap = {
    blue:   'border-blue-500/30 bg-blue-500/5',
    green:  'border-green-500/30 bg-green-500/5',
    orange: 'border-orange-500/30 bg-orange-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
    red:    'border-red-500/30 bg-red-500/5',
    cyan:   'border-cyan-500/30 bg-cyan-500/5',
  }
  return (
    <div className={`rounded-xl border p-4 ${ringMap[accent] || 'border-gray-700 bg-gray-800'}`}>
      <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-6">
      {children}
    </h2>
  )
}

function ServiceBadge({ svc }) {
  const color = STATUS_COLORS[svc.status] || '#6b7280'
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
          <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: color }} />
        </span>
        <span className="text-sm font-medium text-white">{svc.name}</span>
      </div>
      <span className="text-xs font-semibold uppercase" style={{ color }}>{svc.status}</span>
    </div>
  )
}

const renderPieLabel = ({ name, percent }) =>
  percent > 0.03 ? `${name} ${(percent * 100).toFixed(0)}%` : null

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdminSystem() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/system-health')
      setData(res.data)
      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch health data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm animate-pulse">
      Loading system health…
    </div>
  )

  if (error) return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
      <p className="text-red-400 font-medium">{error}</p>
      <button onClick={load} className="mt-3 text-xs text-gray-400 hover:text-white underline">Retry</button>
    </div>
  )

  const { services = [], judge = {}, ai = {}, mongo = {}, process: proc = {} } = data
  const counters          = judge.counters          || {}
  const verdicts          = judge.verdicts          || {}
  const languages         = judge.languages         || {}
  const execTime          = judge.exec_time         || {}
  const queueWait         = judge.queue_wait        || {}
  const throughput        = judge.throughput        || {}
  const throughputSeries  = judge.throughput_series || []
  const redis             = judge.redis             || {}
  const workers           = judge.workers           || []

  // Only show sections when actual data exists
  const judgeAvailable   = judge.status !== 'unavailable'
  const hasCounters      = judgeAvailable && counters.total_submissions != null
  const hasThroughput    = judgeAvailable && (throughput.last_5m != null || throughputSeries.length > 0)
  const hasExecData      = (execTime.sample_count  || 0) > 0
  const hasQueueData     = (queueWait.sample_count || 0) > 0
  const hasRedis         = redis.role != null
  const hasMongo         = mongo.status === 'connected'

  const verdictData = Object.entries(verdicts)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)

  const langData = Object.entries(languages)
    .map(([name, value]) => ({ name, value, fill: LANG_COLORS[name] || '#6b7280' }))
    .filter(d => d.value > 0)

  const execPercentiles = [
    { name: 'avg', value: execTime.exec_time_ms_avg || 0 },
    { name: 'p50', value: execTime.exec_time_ms_p50 || 0 },
    { name: 'p95', value: execTime.exec_time_ms_p95 || 0 },
    { name: 'p99', value: execTime.exec_time_ms_p99 || 0 },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">System Health</h1>
          <p className="text-sm text-gray-400 mt-0.5">Real-time microservice telemetry &amp; judge analytics</p>
        </div>
        <div className="text-right">
          <button
            onClick={load}
            className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300"
          >
            ↻ Refresh
          </button>
          {lastRefresh && <p className="text-xs text-gray-600 mt-1">Last: {lastRefresh.toLocaleTimeString()}</p>}
        </div>
      </div>

      {/* Service Status */}
      <SectionTitle>Service Status</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        {services.map(svc => <ServiceBadge key={svc.name} svc={svc} />)}
      </div>

      {/* AI Service info (only when online) */}
      {ai.status === 'ok' && (
        <>
          <SectionTitle>AI Problem Service</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Status"        value="Online"              accent="green" />
            <StatCard label="Redis"         value={ai.redis ? 'Connected' : 'Error'} accent={ai.redis ? 'cyan' : 'red'} />
            <StatCard label="Service"       value={ai.service || 'ai-problem-service'} accent="blue" />
            <StatCard label="Groq Model"    value="Llama 3.3 70B"      accent="purple" />
          </div>
        </>
      )}

      {/* Counters — only when judge has submitted at least 1 job */}
      {hasCounters && (
        <>
          <SectionTitle>Submission Counters</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Queued"  value={fmt(counters.total_submissions)} accent="blue" />
            <StatCard label="Completed"     value={fmt(counters.completed)}         accent="green" />
            <StatCard label="In Progress"   value={fmt(counters.in_progress)}       accent="cyan" />
            <StatCard label="Pending Queue" value={fmt(counters.pending_queue)}     accent="orange" />
            <StatCard label="Failed"        value={fmt(counters.failed)}            accent="red" />
            <StatCard label="Acceptance %"  value={`${counters.acceptance_rate_pct ?? '—'}%`} accent="purple" />
          </div>
        </>
      )}

      {/* Throughput KPIs + time-series — only when judge is available */}
      {hasThroughput && (
        <>
          <SectionTitle>Throughput</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Last 5 min"      value={fmt(throughput.last_5m)}  sub="submissions" accent="blue" />
            <StatCard label="Last 15 min"     value={fmt(throughput.last_15m)} sub="submissions" accent="blue" />
            <StatCard label="Last 1 hr"       value={fmt(throughput.last_1h)}  sub="submissions" accent="blue" />
            <StatCard label="Rate (5-min avg)" value={throughput.submissions_per_min_5m != null ? `${throughput.submissions_per_min_5m}/min` : '—'} accent="cyan" />
          </div>

          {throughputSeries.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 mb-4">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Submissions per Minute — Last 30 min</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={throughputSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280' }} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#9ca3af' }} itemStyle={{ color: '#3b82f6' }} />
              <Area type="monotone" dataKey="submissions" stroke="#3b82f6" fill="url(#tpGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
        </>
      )}

      {/* Verdict + Language — only when there are actual submissions */}
      {(verdictData.length > 0 || langData.length > 0) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {verdictData.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Verdict Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={verdictData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={renderPieLabel} labelLine={false}>
                {verdictData.map(entry => <Cell key={entry.name} fill={VERDICT_COLORS[entry.name] || '#6b7280'} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }} itemStyle={{ color: '#d1d5db' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        )}

        {langData.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Language Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={langData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="value" label={{ position: 'top', fontSize: 10, fill: '#9ca3af' }}>
                {langData.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
        </div>
      )}

      {/* Exec time + Queue wait — only when samples exist */}
      {(hasExecData || hasQueueData) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {hasExecData && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Execution Time Percentiles</p>
          <p className="text-xs text-gray-600 mb-3">Samples: {execTime.sample_count ?? 0} &nbsp;·&nbsp; Min: {ms(execTime.exec_time_ms_min)} &nbsp;·&nbsp; Max: {ms(execTime.exec_time_ms_max)}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={execPercentiles} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" ms" />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }} formatter={(v) => [`${v} ms`]} labelStyle={{ color: '#9ca3af' }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {hasQueueData && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Queue Wait Time Percentiles</p>
          <p className="text-xs text-gray-600 mb-3">Samples: {queueWait.sample_count ?? 0} &nbsp;·&nbsp; Avg: {ms(queueWait.queue_wait_ms_avg)}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={[
                { name: 'avg', value: queueWait.queue_wait_ms_avg || 0 },
                { name: 'p50', value: queueWait.queue_wait_ms_p50 || 0 },
                { name: 'p95', value: queueWait.queue_wait_ms_p95 || 0 },
                { name: 'p99', value: queueWait.queue_wait_ms_p99 || 0 },
              ]}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" ms" />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }} formatter={(v) => [`${v} ms`]} labelStyle={{ color: '#9ca3af' }} />
              <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>
      )}

      {/* Workers — only when judge is available */}
      {judgeAvailable && (
        <>
          <SectionTitle>Celery Workers ({judge.worker_count ?? workers.length})</SectionTitle>
          {workers.length === 0
            ? <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4 text-center text-gray-500 text-sm">No workers connected</div>
            : (
              <div className="grid gap-3">
                {workers.map((w, i) => (
                  <div key={i} className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-white truncate max-w-xs">{w.name}</p>
                      <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-2 py-0.5">
                        Active: {w.active_jobs} / {w.capacity}
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((w.active_jobs / (parseInt(w.capacity) || 4)) * 100, 100)}%` }}
                  />
                </div>
                {w.active_tasks?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {w.active_tasks.map((t, j) => (
                      <p key={j} className="text-xs text-gray-500 font-mono truncate">
                        ↳ {t.id?.slice(0, 8)}… &nbsp; PID {t.worker_pid}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
        </>
      )}

      {/* Redis + MongoDB + Process */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">

        {/* Redis — only when data is available */}
        {hasRedis && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Redis</p>
          <div className="space-y-2">
            {[
              ['Role',        redis.role || '—'],
              ['Memory Used', mb(redis.used_memory_mb)],
              ['Memory Peak', mb(redis.used_memory_peak_mb)],
              ['Clients',     fmt(redis.connected_clients)],
              ['Hit Rate',    redis.hit_rate_pct != null ? `${redis.hit_rate_pct}%` : '—'],
              ['Uptime',      redis.uptime_days != null ? `${redis.uptime_days}d` : '—'],
              ['Commands',    fmt(redis.total_commands_processed)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-500">{k}</span>
                <span className="text-white font-mono">{v}</span>
              </div>
            ))}
          </div>
          {redis.used_memory_mb != null && redis.used_memory_peak_mb != null && (
            <div className="mt-4">
              <p className="text-xs text-gray-600 mb-1">Memory vs Peak</p>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${Math.min((redis.used_memory_mb / redis.used_memory_peak_mb) * 100, 100).toFixed(0)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {((redis.used_memory_mb / redis.used_memory_peak_mb) * 100).toFixed(1)}% of peak ({redis.used_memory_peak_mb} MB)
              </p>
            </div>
          )}
        </div>
        )}

        {/* MongoDB — only when connected */}
        {hasMongo && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">MongoDB</p>
          <div className="space-y-2">
            {[
              ['Status',      mongo.status || '—'],
              ['Connections', mongo.current_connections != null
                ? `${mongo.current_connections} / ${mongo.current_connections + (mongo.available_connections || 0)}`
                : '—'],
              ['Inserts',     fmt(mongo.ops_insert)],
              ['Queries',     fmt(mongo.ops_query)],
              ['Updates',     fmt(mongo.ops_update)],
              ['Deletes',     fmt(mongo.ops_delete)],
              ['Resident',    mb(mongo.resident_mb)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-500">{k}</span>
                <span className={`font-mono ${k === 'Status' ? (mongo.status === 'connected' ? 'text-green-400' : 'text-red-400') : 'text-white'}`}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
        )}
        {/* Node process — always available */}
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Backend Process</p>
          <div className="space-y-2">
            {[
              ['Uptime',     proc.uptime_human || '—'],
              ['Node',       proc.node_version || '—'],
              ['PID',        proc.pid || '—'],
              ['Heap Used',  mb(proc.heap_used_mb)],
              ['Heap Total', mb(proc.heap_total_mb)],
              ['RSS',        mb(proc.rss_mb)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-500">{k}</span>
                <span className="text-white font-mono">{v}</span>
              </div>
            ))}
          </div>
          {proc.heap_used_mb && proc.heap_total_mb ? (
            <div className="mt-4">
              <p className="text-xs text-gray-600 mb-1">Heap utilisation</p>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-violet-500 h-2 rounded-full"
                  style={{ width: `${Math.min((proc.heap_used_mb / proc.heap_total_mb) * 100, 100).toFixed(0)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {((proc.heap_used_mb / proc.heap_total_mb) * 100).toFixed(1)}% of {proc.heap_total_mb} MB
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-700 text-center mt-6">
        Health endpoint latency: {data?.response_ms ?? '—'} ms &nbsp;·&nbsp; Auto-refresh every 15 s &nbsp;·&nbsp;
        {lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString()}` : ''}
      </p>
    </div>
  )
}
