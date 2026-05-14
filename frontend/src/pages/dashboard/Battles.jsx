/**
 * Battles.jsx — full 1v1 live battle page
 * See battleSocket.js for server-side logic.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import Editor from '@monaco-editor/react'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const LANGUAGES = [
  { value: 'cpp',        label: 'C++ 17' },
  { value: 'python',     label: 'Python 3' },
  { value: 'javascript', label: 'JavaScript' },
]
const MONACO_LANG = { cpp: 'cpp', python: 'python', javascript: 'javascript' }
const DEFAULT_CODE = {
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    // Your code here\n    \n    return 0;\n}`,
  python: `import sys\ninput = sys.stdin.readline\n\ndef main():\n    # Your code here\n    pass\n\nif __name__ == "__main__":\n    main()`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nlet idx = 0;\n\n// Your code here\n`,
}
const DIFF_COLOR = {
  easy:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  hard:   'text-red-400 bg-red-400/10 border-red-400/20',
}
const RESULT_CFG = {
  win:  { cls: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', label: '🏆 You Won!' },
  loss: { cls: 'bg-red-500/15 border-red-500/30 text-red-400',            label: '💔 You Lost' },
  draw: { cls: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',   label: '🤝 Draw' },
}
const VERDICT_CLS = {
  AC: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  Accepted: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  WA: 'text-red-400 bg-red-400/10 border-red-400/30',
  'Wrong Answer': 'text-red-400 bg-red-400/10 border-red-400/30',
  TLE: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  RE: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  CE: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  'Compile Error': 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  Error: 'text-red-400 bg-red-400/10 border-red-400/30',
}
const vCls = (v) => VERDICT_CLS[v] || 'text-white/50 bg-white/5 border-white/10'
const fmtMs = (ms) => {
  if (ms == null) return '—'
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
const fmtDelta = (d) => {
  if (!d) return <span className="text-white/30">±0</span>
  return d > 0 ? <span className="text-emerald-400">+{d}</span> : <span className="text-red-400">{d}</span>
}

// ── Small components ──────────────────────────────────────────────────────────
function Badge({ label, cls }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>
}
function SH({ children }) {
  return <h4 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">{children}</h4>
}
function CodeBlock({ code }) {
  return (
    <pre className="bg-black/40 border border-white/8 rounded-lg p-3 text-xs font-mono text-green-300 overflow-x-auto whitespace-pre-wrap">
      {code || '(empty)'}
    </pre>
  )
}
function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white/3 border border-white/8 rounded-xl p-4">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </div>
  )
}
function DiffSel({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {['easy','medium','hard'].map((d) => (
        <button key={d} onClick={() => onChange(d)}
          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer capitalize ${value===d ? DIFF_COLOR[d] : 'border-white/10 text-white/40 hover:text-white/70'}`}>
          {d}
        </button>
      ))}
    </div>
  )
}
function Spinner() {
  return <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
}

// ── Countdown timer ───────────────────────────────────────────────────────────
function CountdownTimer({ startedAt, durationMs }) {
  const [rem, setRem] = useState(() => Math.max(0, durationMs - (Date.now() - new Date(startedAt).getTime())))
  useEffect(() => {
    const id = setInterval(() => setRem(Math.max(0, durationMs - (Date.now() - new Date(startedAt).getTime()))), 1000)
    return () => clearInterval(id)
  }, [startedAt, durationMs])
  const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000)
  return (
    <span className={`font-mono font-bold tabular-nums text-lg leading-none ${rem < 60000 ? 'text-red-400 animate-pulse' : rem < 300000 ? 'text-orange-400' : 'text-white'}`}>
      {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </span>
  )
}

// ── Problem panel ─────────────────────────────────────────────────────────────
function ProblemPanel({ problem }) {
  const [tab, setTab] = useState('statement')
  if (!problem) return <div className="flex items-center justify-center h-full text-white/30 text-sm">Loading problem…</div>
  const tabs = [{ id:'statement',label:'Statement'},{id:'io',label:'I/O'},{id:'examples',label:'Examples'}]
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-white/8">
        <h2 className="text-sm font-semibold text-white">{problem.title}</h2>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge label={problem.difficulty} cls={DIFF_COLOR[problem.difficulty]||DIFF_COLOR.medium}/>
          <span className="text-xs text-white/40">{problem.timeLimitMs}ms</span>
          <span className="text-xs text-white/40">{problem.memoryLimitMb}MB</span>
          {problem.tags?.slice(0,3).map(t=><span key={t} className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/40">{t}</span>)}
        </div>
        <div className="flex mt-2 -mb-px">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${tab===t.id?'border-violet-500 text-violet-400':'border-transparent text-white/50 hover:text-white/80'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 text-sm">
        {tab==='statement' && (
          <>
            <div className="text-white/80 leading-relaxed whitespace-pre-wrap">{problem.description}</div>
            {problem.constraints && <div><SH>Constraints</SH><div className="text-white/70 whitespace-pre-wrap bg-white/3 rounded-lg p-3 border border-white/8">{problem.constraints}</div></div>}
            <div className="grid grid-cols-2 gap-2">
              {[['Time Limit',`${problem.timeLimitMs}ms`],['Memory',`${problem.memoryLimitMb}MB`],
                problem.optimalTimeComplexity&&['Optimal Time',problem.optimalTimeComplexity],
                problem.optimalSpaceComplexity&&['Optimal Space',problem.optimalSpaceComplexity],
              ].filter(Boolean).map(([l,v])=>(
                <div key={l} className="bg-white/3 border border-white/8 rounded-lg p-2">
                  <p className="text-[10px] text-white/40">{l}</p><p className="text-xs text-white font-mono">{v}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {tab==='io' && (
          <>
            {problem.inputFormat  && <div><SH>Input Format</SH><p className="text-white/70 whitespace-pre-wrap">{problem.inputFormat}</p></div>}
            {problem.outputFormat && <div><SH>Output Format</SH><p className="text-white/70 whitespace-pre-wrap">{problem.outputFormat}</p></div>}
            {!problem.inputFormat&&!problem.outputFormat && <p className="text-white/30">No I/O format available.</p>}
          </>
        )}
        {tab==='examples' && (
          <>
            {(problem.sampleInput||problem.sampleOutput) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><SH>Sample Input</SH><CodeBlock code={problem.sampleInput}/></div>
                  <div><SH>Sample Output</SH><CodeBlock code={problem.sampleOutput}/></div>
                </div>
                {problem.sampleExplanation && <div><SH>Explanation</SH><div className="text-white/70 whitespace-pre-wrap bg-white/3 rounded-lg p-3 border border-white/8">{problem.sampleExplanation}</div></div>}
              </>
            )}
            {problem.publicTests?.length>0 && (
              <div><SH>Public Test Cases</SH>
                {problem.publicTests.map((tc,i)=>(
                  <div key={i} className="grid grid-cols-2 gap-2 mb-3">
                    <div><p className="text-[10px] text-white/30 mb-1">Input #{i+1}</p><CodeBlock code={tc.input}/></div>
                    <div><p className="text-[10px] text-white/30 mb-1">Expected #{i+1}</p><CodeBlock code={tc.expected_output||tc.output}/></div>
                  </div>
                ))}
              </div>
            )}
            {!problem.sampleInput&&!problem.publicTests?.length && <p className="text-white/30">No examples available.</p>}
          </>
        )}
      </div>
    </div>
  )
}

// ── Output panel ──────────────────────────────────────────────────────────────
function OutputPanel({ result }) {
  if (!result) return null
  return (
    <div className="space-y-2">
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${vCls(result.verdict)}`}>
        <span className="font-semibold">{result.verdict}</span>
        <span className="text-xs opacity-70">
          {result.passed_tests??0}/{result.total_tests??'?'} tests
          {result.time_ms!=null&&` · ${result.time_ms.toFixed(0)}ms`}
          {result.attempts!=null&&` · attempt #${result.attempts}`}
        </span>
      </div>
      {result.compile_error && (
        <div className="border border-violet-400/30 rounded-lg bg-violet-400/5 p-3">
          <p className="text-xs text-violet-400 font-semibold mb-1">Error</p>
          <pre className="text-xs font-mono text-violet-300/80 whitespace-pre-wrap overflow-x-auto">{result.compile_error}</pre>
        </div>
      )}
    </div>
  )
}

// ── Battle history row ────────────────────────────────────────────────────────
function HistoryRow({ b }) {
  const rc={win:{c:'text-emerald-400',l:'WIN'},loss:{c:'text-red-400',l:'LOSS'},draw:{c:'text-yellow-400',l:'DRAW'}}[b.result]||{c:'text-white/40',l:'—'}
  return (
    <tr className="border-b border-white/5 hover:bg-white/2 text-sm">
      <td className="px-4 py-3"><span className={`font-bold text-xs ${rc.c}`}>{rc.l}</span></td>
      <td className="px-4 py-3 text-white/80">{b.opponent.username}</td>
      <td className="px-4 py-3 text-white/50 truncate max-w-[160px]">{b.problem?.title||'—'}</td>
      <td className="px-4 py-3"><Badge label={b.difficulty} cls={DIFF_COLOR[b.difficulty]||DIFF_COLOR.medium}/></td>
      <td className="px-4 py-3 text-center font-mono text-xs">{fmtDelta(b.ratingDelta)}</td>
      <td className="px-4 py-3 text-center text-white/40 text-xs">{fmtMs(b.solveTimeMs)}</td>
      <td className="px-4 py-3 text-right text-white/30 text-xs">{b.endedAt?new Date(b.endedAt).toLocaleDateString():'—'}</td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function Battles() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  // view: 'lobby'|'queueing'|'challenge_created'|'joining_challenge'|'battle'|'result'
  const [view, setView] = useState('lobby')

  // lobby
  const [stats,        setStats]        = useState(null)
  const [history,      setHistory]      = useState([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [selectedDiff, setSelectedDiff] = useState('medium')
  const [joinCode,     setJoinCode]     = useState('')
  const [error,        setError]        = useState('')
  const [toast,        setToast]        = useState('')

  // challenge
  const [chalCode, setChalCode] = useState('')
  const [chalDiff, setChalDiff] = useState('medium')

  // battle room
  const [battleInfo,    setBattleInfo]    = useState(null)
  const [problemDetail, setProblemDetail] = useState(null)
  const [language,      setLanguage]      = useState('cpp')
  const [code,          setCode]          = useState(DEFAULT_CODE.cpp)
  const codeRef = useRef(DEFAULT_CODE.cpp)

  const [myAttempts,   setMyAttempts]   = useState(0)
  const [oppAttempts,  setOppAttempts]  = useState(0)
  const [oppSolved,    setOppSolved]    = useState(false)
  const [mySolved,     setMySolved]     = useState(false)

  const [running,      setRunning]      = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [runResult,    setRunResult]    = useState(null)
  const [subResult,    setSubResult]    = useState(null)
  const [activeRes,    setActiveRes]    = useState(null) // 'run'|'submit'

  // result
  const [battleResult, setBattleResult] = useState(null)

  // ── Toast helper ──────────────────────────────────────────────────────────
  const notify = useCallback((msg) => {
    setToast(msg); setTimeout(() => setToast(''), 4000)
  }, [])

  // ── Fetch lobby data ──────────────────────────────────────────────────────
  const fetchLobby = useCallback(async () => {
    setStatsLoading(true)
    try {
      const [s, h] = await Promise.all([api.get('/api/battles/stats'), api.get('/api/battles/history')])
      setStats(s.data); setHistory(h.data.history || [])
    } catch { /* non-fatal */ } finally { setStatsLoading(false) }
  }, [])

  useEffect(() => { if (view === 'lobby') fetchLobby() }, [view, fetchLobby])

  // ── Fetch problem detail when battle starts ───────────────────────────────
  useEffect(() => {
    if (view !== 'battle' || !battleInfo?.problem?.slug) return
    api.get(`/api/problems/${battleInfo.problem.slug}`)
      .then(r => setProblemDetail(r.data)).catch(() => setProblemDetail(null))
  }, [view, battleInfo?.problem?.slug])

  // ── Challenge URL param ───────────────────────────────────────────────────
  useEffect(() => {
    const p = searchParams.get('challenge')
    if (p) { setJoinCode(p.toUpperCase()); setView('joining_challenge') }
  }, []) // eslint-disable-line

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket','polling'], reconnection: true, reconnectionDelay: 2000 })
    socketRef.current = socket

    socket.on('connect',       () => setConnected(true))
    socket.on('disconnect',    () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))

    socket.on('battle:queued', ({ difficulty, yourRating }) => {
      setView('queueing'); notify(`Searching for ${difficulty} opponent… Rating: ${yourRating}`)
    })
    socket.on('battle:queue_left', () => setView('lobby'))

    socket.on('battle:challenge_created', ({ challengeCode: c, difficulty: d }) => {
      setChalCode(c); setChalDiff(d); setView('challenge_created')
    })
    socket.on('battle:challenge_expired', () => { notify('Challenge expired.'); setView('lobby') })

    const enterBattle = (data) => {
      setBattleInfo(data); setProblemDetail(null)
      setMyAttempts(0); setOppAttempts(0); setOppSolved(false); setMySolved(false)
      setRunResult(null); setSubResult(null); setActiveRes(null)
      const fresh = DEFAULT_CODE[language] || DEFAULT_CODE.cpp
      codeRef.current = fresh; setCode(fresh)
      setView('battle')
    }

    socket.on('battle:matched', enterBattle)

    socket.on('battle:state_restored', (data) => {
      setBattleInfo({ battleId:data.battleId, problem:data.problem, opponent:data.opponent, startedAt:data.startedAt, durationMs:data.durationMs, myIndex:data.myIndex })
      setProblemDetail(null)
      setMyAttempts(data.myAttempts||0); setOppAttempts(data.opponentAttempts||0)
      setOppSolved(data.opponentSolved||false); setMySolved(data.mySolved||false)
      if (data.myCode) { codeRef.current = data.myCode; setCode(data.myCode) }
      if (data.myLanguage) setLanguage(data.myLanguage)
      setView('battle'); notify('Reconnected to battle!')
    })

    socket.on('battle:opponent_attempt', ({ attempts }) => setOppAttempts(attempts))
    socket.on('battle:you_solved',       ({ solveTimeMs }) => { setMySolved(true); notify(`✅ Solved in ${fmtMs(solveTimeMs)}!`) })
    socket.on('battle:opponent_solved',  ({ solveTimeMs }) => { setOppSolved(true); notify(`Opponent solved in ${fmtMs(solveTimeMs)}`) })

    socket.on('battle:judge_result', (data) => {
      setSubmitting(false); setSubResult(data); setActiveRes('submit')
      setMyAttempts(data.attempts || 0)
    })

    socket.on('battle:time_up',             () => notify('⏱ Time is up!'))
    socket.on('battle:opponent_forfeited',  () => notify('Opponent forfeited!'))
    socket.on('battle:opponent_disconnected', () => notify('Opponent disconnected (60s to reconnect…)'))

    socket.on('battle:result', (result) => { setBattleResult(result); setView('result') })
    socket.on('battle:error', ({ message }) => { setError(message); setTimeout(() => setError(''), 4000) })

    return () => socket.disconnect()
  }, []) // eslint-disable-line

  // ── Actions ───────────────────────────────────────────────────────────────
  const emit   = (ev, data) => socketRef.current?.emit(ev, data)
  const needConn = () => { if (!connected) { setError('Connecting…'); return true } setError(''); return false }

  const joinQueue      = () => { if (needConn()) return; emit('battle:join_queue',      { difficulty: selectedDiff }) }
  const leaveQueue     = () => emit('battle:leave_queue')
  const createChallenge = () => { if (needConn()) return; emit('battle:challenge_create', { difficulty: selectedDiff }) }
  const cancelChallenge = () => { emit('battle:challenge_cancel'); setView('lobby') }
  const acceptChallenge = (c) => {
    const code = (c || joinCode).trim().toUpperCase()
    if (code.length < 4) return setError('Enter a valid code.')
    if (needConn()) return
    emit('battle:challenge_accept', { challengeCode: code })
  }
  const handleForfeit = () => {
    if (!window.confirm('Forfeit this battle? You will lose rating points.')) return
    emit('battle:forfeit', { battleId: battleInfo?.battleId })
  }

  const handleCodeChange = (val) => { codeRef.current = val ?? ''; setCode(val ?? '') }
  const handleLangChange = (lang) => {
    setLanguage(lang)
    if (Object.values(DEFAULT_CODE).includes(codeRef.current)) {
      codeRef.current = DEFAULT_CODE[lang]; setCode(DEFAULT_CODE[lang])
    }
  }

  const handleRun = async () => {
    if (running || submitting || !battleInfo?.problem?.slug) return
    setRunning(true); setRunResult(null); setActiveRes('run')
    try {
      const { data } = await api.post('/api/judge/run', { slug: battleInfo.problem.slug, code: codeRef.current, language })
      setRunResult(data)
    } catch (e) {
      setRunResult({ verdict: 'Error', compile_error: e.response?.data?.error || 'Request failed' })
    } finally { setRunning(false) }
  }

  const handleSubmit = () => {
    if (running || submitting || mySolved || !battleInfo) return
    setSubmitting(true); setSubResult(null); setActiveRes('submit')
    emit('battle:submit', { battleId: battleInfo.battleId, code: codeRef.current, language })
  }

  const goLobby = () => { setBattleInfo(null); setProblemDetail(null); setBattleResult(null); setView('lobby') }

  const myResult = (() => {
    if (!battleResult || !user) return null
    const myId = String(user._id || user.id)
    if (battleResult.draw) return 'draw'
    return String(battleResult.winnerId) === myId ? 'win' : 'loss'
  })()

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] min-h-0 relative overflow-hidden">

      {/* Toast */}
      {toast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-white/15 rounded-xl px-5 py-2.5 text-sm text-white shadow-2xl pointer-events-none">
          {toast}
        </div>
      )}
      {error && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 border border-red-500/40 rounded-xl px-5 py-2.5 text-sm text-red-300 shadow-2xl pointer-events-none">
          {error}
        </div>
      )}

      {/* ── LOBBY ─────────────────────────────────────────────────────────────── */}
      {view === 'lobby' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">⚔️ Battles</h1>
              <p className="text-sm text-white/50 mt-0.5">1v1 real-time competitive programming duels</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
              <span className="text-xs text-white/40">{connected ? 'Connected' : 'Connecting…'}</span>
            </div>
          </div>

          {/* Stats */}
          {statsLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_,i)=><div key={i} className="bg-white/3 border border-white/8 rounded-xl p-4 h-20 animate-pulse"/>)}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Battle Rating" value={stats.rating} sub={stats.total>0?`${stats.winRate??0}% win rate`:'No battles yet'}/>
              <StatCard label="Wins" value={stats.wins} sub={`${stats.total} total`}/>
              <StatCard label="Losses" value={stats.losses}/>
              <StatCard label="Win Streak" value={`${stats.streak}${stats.streak>=3?' 🔥':''}`}
                sub={stats.streak>=3?`+${stats.streak>=9?'50':stats.streak>=6?'30':'10'}% Elo bonus`:'Win 3 to activate bonus'}/>
            </div>
          ) : null}

          {/* Create battle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Random */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">⚔️ Find Opponent
                  <span className="text-xs font-normal text-white/40">Matched within ±150 rating</span>
                </h3>
              </div>
              <div><p className="text-xs text-white/50 mb-2">Difficulty</p><DiffSel value={selectedDiff} onChange={setSelectedDiff}/></div>
              <button onClick={joinQueue} disabled={!connected}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                Find Opponent
              </button>
            </div>

            {/* Challenge */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">🤝 Challenge Friend</h3>
              <div><p className="text-xs text-white/50 mb-2">Difficulty</p><DiffSel value={selectedDiff} onChange={setSelectedDiff}/></div>
              <button onClick={createChallenge} disabled={!connected}
                className="w-full py-2 rounded-xl text-sm font-medium border border-violet-500/40 text-violet-400 hover:bg-violet-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                Create Private Room
              </button>
              <div className="flex gap-2">
                <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="Code (e.g. ABC123)"
                  maxLength={6} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 font-mono tracking-widest focus:outline-none focus:border-violet-500/60"/>
                <button onClick={()=>acceptChallenge(joinCode)} disabled={!connected||joinCode.length<4}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* History */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">🏆 Battle History</h3>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/25 gap-2">
                <span className="text-4xl">⚔️</span>
                <p className="text-sm">No battles yet — fight your first duel!</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/8">
                <table className="w-full text-left">
                  <thead className="bg-black/30 text-xs text-white/30 uppercase tracking-widest">
                    <tr>
                      <th className="px-4 py-2.5">Result</th>
                      <th className="px-4 py-2.5">Opponent</th>
                      <th className="px-4 py-2.5">Problem</th>
                      <th className="px-4 py-2.5">Diff</th>
                      <th className="px-4 py-2.5 text-center">Rating Δ</th>
                      <th className="px-4 py-2.5 text-center">Solve Time</th>
                      <th className="px-4 py-2.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(b => <HistoryRow key={b.battleId} b={b}/>)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── QUEUEING ─────────────────────────────────────────────────────────── */}
      {view === 'queueing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="text-center space-y-3">
            <div className="text-6xl animate-bounce">⚔️</div>
            <h2 className="text-xl font-bold text-white">Searching for Opponent…</h2>
            <Badge label={selectedDiff} cls={DIFF_COLOR[selectedDiff]||DIFF_COLOR.medium}/>
            <p className="text-xs text-white/30">Rating window expands every 30 s if no match found</p>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin"/>
            <span className="absolute text-2xl">🔍</span>
          </div>
          <button onClick={leaveQueue}
            className="px-6 py-2.5 rounded-xl text-sm font-medium border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-colors cursor-pointer">
            Cancel
          </button>
        </div>
      )}

      {/* ── CHALLENGE CREATED ────────────────────────────────────────────────── */}
      {view === 'challenge_created' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="text-center space-y-2">
            <div className="text-5xl">🤝</div>
            <h2 className="text-xl font-bold text-white">Challenge Created!</h2>
            <p className="text-sm text-white/50">Share this code with your friend</p>
            <Badge label={chalDiff} cls={DIFF_COLOR[chalDiff]||DIFF_COLOR.medium}/>
          </div>
          <div className="bg-white/5 border border-white/15 rounded-2xl p-8 flex flex-col items-center gap-4 w-full max-w-sm">
            <p className="text-xs text-white/40 uppercase tracking-widest">Challenge Code</p>
            <span className="text-5xl font-mono font-bold tracking-[0.3em] text-violet-300 select-all">{chalCode}</span>
            <div className="flex gap-3">
              <button onClick={()=>{ navigator.clipboard.writeText(chalCode); notify('Code copied!') }}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors cursor-pointer">
                Copy Code
              </button>
              <button onClick={()=>{ navigator.clipboard.writeText(`${window.location.origin}/dashboard/battles?challenge=${chalCode}`); notify('Link copied!') }}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer">
                Copy Link
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-ping"/>
            Waiting for your friend to join…
          </div>
          <button onClick={cancelChallenge}
            className="px-6 py-2.5 rounded-xl text-sm font-medium border border-white/15 text-white/50 hover:text-white hover:border-white/30 transition-colors cursor-pointer">
            Cancel
          </button>
        </div>
      )}

      {/* ── JOIN CHALLENGE ───────────────────────────────────────────────────── */}
      {view === 'joining_challenge' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <div className="text-center space-y-2">
            <div className="text-5xl">🎯</div>
            <h2 className="text-xl font-bold text-white">Join a Battle</h2>
            <p className="text-sm text-white/50">Enter the 6-character challenge code</p>
          </div>
          <div className="w-full max-w-xs space-y-4">
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6}
              className="w-full text-center text-3xl font-mono font-bold tracking-[0.4em] bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"/>
            <button onClick={()=>acceptChallenge(joinCode)} disabled={!connected||joinCode.length<4}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
              Join Battle
            </button>
            <button onClick={()=>setView('lobby')} className="w-full py-2 text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer">
              ← Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* ── BATTLE ROOM ─────────────────────────────────────────────────────── */}
      {view === 'battle' && battleInfo && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Top bar */}
          <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-2.5 border-b border-white/8 bg-black/30">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={()=>setView('lobby')} className="text-xs text-white/40 hover:text-white/70 cursor-pointer shrink-0">← Lobby</button>
              <span className="text-white/20">|</span>
              <span className="text-sm font-medium text-white truncate max-w-[160px]">{battleInfo.problem.title}</span>
              <Badge label={battleInfo.problem.difficulty} cls={DIFF_COLOR[battleInfo.problem.difficulty]||DIFF_COLOR.medium}/>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-white/40">⏱</span>
              <CountdownTimer startedAt={battleInfo.startedAt} durationMs={battleInfo.durationMs}/>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm min-w-0">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs overflow-hidden shrink-0">
                  {battleInfo.opponent.avatar
                    ? <img src={battleInfo.opponent.avatar} className="w-full h-full object-cover" alt=""/>
                    : battleInfo.opponent.username?.[0]?.toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <span className="text-white/70 text-xs block truncate max-w-[90px]">{battleInfo.opponent.username}</span>
                  <span className="text-white/30 text-[10px]">
                    {battleInfo.opponent.rating} · {oppAttempts} tries{oppSolved?' · ✅':''}
                  </span>
                </div>
              </div>
              <div className="text-xs text-white/40 shrink-0">
                Me: {myAttempts} tries{mySolved?' · ✅':''}
              </div>
              <button onClick={handleForfeit}
                className="px-3 py-1 rounded-lg text-xs border border-red-500/30 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer shrink-0">
                Forfeit
              </button>
            </div>
          </div>

          {/* Split panel */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left 40%: problem */}
            <div className="w-[40%] min-w-0 border-r border-white/8 flex flex-col min-h-0">
              <ProblemPanel problem={problemDetail}/>
            </div>

            {/* Right 60%: editor */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Toolbar */}
              <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-white/8 bg-black/20">
                <select value={language} onChange={e=>handleLangChange(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/60 cursor-pointer">
                  {LANGUAGES.map(l=><option key={l.value} value={l.value} className="bg-gray-900">{l.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={handleRun} disabled={running||submitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    {running?<><Spinner/> Running…</>:'▶ Run'}
                  </button>
                  <button onClick={handleSubmit} disabled={running||submitting||mySolved}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    {submitting?<><Spinner/> Judging…</>:mySolved?'✅ Solved!':'↑ Submit'}
                  </button>
                </div>
              </div>

              {/* Monaco */}
              <div className="min-h-0" style={{ flex: activeRes ? '1 1 55%' : '1 1 100%', overflow: 'hidden' }}>
                <Editor height="100%" language={MONACO_LANG[language]} value={code} onChange={handleCodeChange} theme="vs-dark"
                  options={{ fontSize:13, minimap:{enabled:false}, scrollBeyondLastLine:false, automaticLayout:true, tabSize:4, wordWrap:'on', lineNumbersMinChars:3, padding:{top:10,bottom:10} }}/>
              </div>

              {/* Output */}
              {activeRes && (
                <div className="shrink-0 border-t border-white/8 bg-black/30 overflow-y-auto" style={{maxHeight:'45%'}}>
                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
                    <div className="flex gap-1">
                      {[['run','Run'],['submit','Submit']].map(([k,l])=>(
                        <button key={k} onClick={()=>setActiveRes(k)} disabled={k==='run'?!runResult:!subResult}
                          className={`px-3 py-0.5 text-xs rounded font-medium transition-colors cursor-pointer ${activeRes===k?'bg-white/10 text-white':'text-white/40 hover:text-white/70 disabled:opacity-20'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                    <button onClick={()=>{setActiveRes(null);setRunResult(null);setSubResult(null)}} className="text-white/30 hover:text-white/60 text-xs cursor-pointer">✕</button>
                  </div>
                  <div className="p-3">
                    <OutputPanel result={activeRes==='run'?runResult:subResult}/>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT ──────────────────────────────────────────────────────────── */}
      {view === 'result' && battleResult && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 overflow-y-auto">
          {myResult && (
            <div className={`px-10 py-5 rounded-2xl border text-center ${RESULT_CFG[myResult].cls}`}>
              <p className="text-3xl font-bold">{RESULT_CFG[myResult].label}</p>
              {myResult!=='draw' && <p className="text-sm opacity-70 mt-1">{myResult==='win'?'You solved it first! 🎉':'Better luck next time!'}</p>}
            </div>
          )}

          {/* Player cards */}
          <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
            {[battleResult.player1, battleResult.player2].map((p, idx) => {
              const isMe  = String(p.userId) === String(user?._id || user?.id)
              const isWin = !battleResult.draw && String(battleResult.winnerId) === String(p.userId)
              return (
                <div key={idx} className={`bg-white/3 border rounded-2xl p-5 space-y-3 ${isWin?'border-emerald-500/40 bg-emerald-500/5':'border-white/8'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      {p.username} {isMe&&<span className="text-xs text-violet-400">(You)</span>}
                    </span>
                    {isWin && <span className="text-lg">🏆</span>}
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-white/60">
                      <span>Status</span>
                      <span className={p.solved?'text-emerald-400':'text-red-400/70'}>
                        {p.solved?`✅ Solved in ${fmtMs(p.solveTimeMs)}`:'❌ Not solved'}
                      </span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Attempts</span><span className="text-white">{p.attempts}</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Rating Δ</span><span className="font-semibold">{fmtDelta(p.ratingDelta)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {battleInfo?.problem && (
            <div className="text-center text-sm text-white/40">
              Problem: <span className="text-white/70 font-medium">{battleInfo.problem.title}</span>
              {' '}<Badge label={battleInfo.problem.difficulty} cls={DIFF_COLOR[battleInfo.problem.difficulty]||DIFF_COLOR.medium}/>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap justify-center">
            {battleInfo?.problem?.slug && (
              <button onClick={()=>navigate(`/dashboard/problems/${battleInfo.problem.slug}`)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors cursor-pointer">
                View Problem
              </button>
            )}
            <button onClick={goLobby}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors cursor-pointer">
              ⚔️ Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
