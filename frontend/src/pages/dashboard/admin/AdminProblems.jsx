import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../../lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────
const TOPIC_SUGGESTIONS = [
  'arrays', 'strings', 'graphs', 'trees', 'dp', 'math', 'greedy',
  'binary search', 'two pointers', 'sorting', 'number theory',
  'segment trees', 'hashing', 'bfs', 'dfs', 'divide and conquer',
  'stack', 'queue', 'heap', 'bit manipulation',
]

const STATUSES = {
  queued:                 { label: 'Queued',               color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  generating_statement:   { label: 'Generating Statement', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  generating_solution:    { label: 'Generating Solution',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  generating_tcgen:       { label: 'Generating TestGen',   color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  running_docker:         { label: 'Running Docker',       color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  validating:             { label: 'Validating',           color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  completed:              { label: 'Completed',            color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  failed:                 { label: 'Failed',               color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const PIPELINE_STEPS = [
  { key: 'generating_statement', label: 'Problem Statement' },
  { key: 'generating_solution',  label: 'Reference Solution' },
  { key: 'generating_tcgen',     label: 'TestCase Generator' },
  { key: 'running_docker',       label: 'Docker Execution' },
  { key: 'validating',           label: 'Validation' },
  { key: 'completed',            label: 'Complete' },
]

const STEP_ORDER = PIPELINE_STEPS.map((s) => s.key)

function cfDiffColor(d) {
  if (d <= 1199) return '#9CA3AF'
  if (d <= 1399) return '#4ADE80'
  if (d <= 1599) return '#34D399'
  if (d <= 1899) return '#60A5FA'
  if (d <= 2099) return '#A78BFA'
  if (d <= 2399) return '#F97316'
  return '#EF4444'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUSES[status] || { label: status, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
  const isLive = !['completed', 'failed'].includes(status)
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>
      {isLive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {s.label}
    </span>
  )
}

function CodeBlock({ code, lang = '' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-xl overflow-hidden border border-gray-700">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-700">
        <span className="text-xs font-mono text-gray-400">{lang || 'code'}</span>
        <button onClick={copy} className="text-xs text-gray-400 hover:text-white transition-colors">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-gray-950 text-gray-100 p-4 text-xs font-mono overflow-x-auto max-h-72 overflow-y-auto leading-relaxed">
        <code>{code || ''}</code>
      </pre>
    </div>
  )
}

function ProgressBar({ progress }) {
  return (
    <div className="w-full bg-gray-800 rounded-full h-2">
      <div
        className="h-2 rounded-full bg-linear-to-r from-violet-500 to-emerald-400 transition-all duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

function PipelineTracker({ status, progress }) {
  const currentIdx = STEP_ORDER.indexOf(status)
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PIPELINE_STEPS.map((step, i) => {
        const done = currentIdx > i || status === 'completed'
        const active = STEP_ORDER[currentIdx] === step.key
        const failed = status === 'failed' && active
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border
              ${failed ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : done ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : active ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
              {done ? '✓' : active ? '⟳' : '○'}
              {step.label}
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <span className={`text-xs ${done ? 'text-emerald-500' : 'text-gray-700'}`}>→</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── TopicInput ────────────────────────────────────────────────────────────────
function TopicInput({ topics, onChange }) {
  const [inputVal, setInputVal] = useState('')
  const addTopic = (t) => {
    const clean = t.trim().toLowerCase()
    if (clean && !topics.includes(clean) && topics.length < 5) {
      onChange([...topics, clean])
    }
    setInputVal('')
  }
  const removeTopic = (t) => onChange(topics.filter((x) => x !== t))
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {topics.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 bg-violet-500/20 text-violet-300 text-xs px-2.5 py-1 rounded-full border border-violet-500/30">
            {t}
            <button onClick={() => removeTopic(t)} className="hover:text-red-400 ml-0.5">×</button>
          </span>
        ))}
        {topics.length < 5 && (
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTopic(inputVal) } }}
            placeholder={topics.length === 0 ? 'Type a topic, press Enter…' : 'Add more…'}
            className="bg-transparent text-sm text-white placeholder-gray-500 outline-none min-w-28"
          />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TOPIC_SUGGESTIONS.filter((t) => !topics.includes(t)).slice(0, 12).map((t) => (
          <button key={t} onClick={() => addTopic(t)}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 px-2 py-0.5 rounded-md border border-gray-700 transition-colors">
            + {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── GenerateForm ──────────────────────────────────────────────────────────────
function GenerateForm({ onSubmit, loading }) {
  const [topics, setTopics] = useState(['arrays'])
  const [difficulty, setDifficulty] = useState(1400)
  const [idea, setIdea] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (topics.length === 0) return
    onSubmit({ topics, difficulty, idea: idea.trim() || null })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Topics */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Topics <span className="text-gray-500 font-normal">(1-5)</span>
        </label>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 min-h-16">
          <TopicInput topics={topics} onChange={setTopics} />
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          CF Difficulty Rating
          <span className="ml-3 text-lg font-bold" style={{ color: cfDiffColor(difficulty) }}>
            {difficulty}
          </span>
          <span className="ml-2 text-xs text-gray-500">
            {difficulty <= 1199 ? '(Beginner)' : difficulty <= 1399 ? '(Easy)' : difficulty <= 1699 ? '(Intermediate)' : difficulty <= 2099 ? '(Advanced)' : '(Expert+)'}
          </span>
        </label>
        <input type="range" min="800" max="3500" step="100"
          value={difficulty} onChange={(e) => setDifficulty(+e.target.value)}
          className="w-full accent-violet-500"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>800</span><span>1200</span><span>1600</span><span>2000</span><span>2400</span><span>3500</span>
        </div>
      </div>

      {/* Idea */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Problem Idea / Hint <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="E.g. 'A problem about finding the minimum number of operations to make an array sorted…'"
          rows={3}
          maxLength={600}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-violet-500 resize-none"
        />
        <div className="text-right text-xs text-gray-600 mt-1">{idea.length}/600</div>
      </div>

      <button type="submit" disabled={loading || topics.length === 0}
        className="w-full py-3 rounded-xl bg-linear-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all">
        {loading ? 'Queueing…' : '⚡ Generate Problem with AI'}
      </button>
    </form>
  )
}

// ── JobDetail ─────────────────────────────────────────────────────────────────
function JobDetail({ job, onPublish, onReject, publishing }) {
  const [tab, setTab] = useState('problem')
  const isComplete = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const isLive = !isComplete && !isFailed

  const publicTcs = (job.test_cases || []).filter((tc) => !tc.is_hidden)
  const privateTcs = (job.test_cases || []).filter((tc) => tc.is_hidden)
  const canPublish = isComplete && publicTcs.length >= 2 && privateTcs.length >= 10

  const TABS = [
    { key: 'problem',   label: 'Problem Statement' },
    { key: 'solution',  label: 'Solutions' },
    { key: 'tcgen',     label: 'TestGen Script' },
    { key: 'testcases', label: `Test Cases (${(job.test_cases || []).length})` },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">{job.name || 'Generating…'}</h2>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <StatusBadge status={job.status} />
            {job.difficulty && (
              <span className="text-sm font-bold" style={{ color: cfDiffColor(job.difficulty) }}>
                CF {job.difficulty}
              </span>
            )}
            {(job.topics || []).map((t) => (
              <span key={t} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md border border-gray-700">{t}</span>
            ))}
          </div>
        </div>
        {isComplete && (
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium border border-gray-700 transition-colors">
              ✕ Reject
            </button>
            <button
              onClick={onPublish}
              disabled={!canPublish || publishing}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
              {publishing ? 'Publishing…' : '✓ Publish Problem'}
            </button>
          </div>
        )}
      </div>

      {/* Progress */}
      {isLive && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-300 font-medium">{job.current_step}</p>
            <span className="text-sm font-bold text-violet-400">{job.progress}%</span>
          </div>
          <ProgressBar progress={job.progress} />
          <PipelineTracker status={job.status} progress={job.progress} />
        </div>
      )}

      {isFailed && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-400 mb-1">Generation Failed</p>
          <p className="text-xs text-red-300/80 font-mono">{job.error || job.current_step}</p>
        </div>
      )}

      {isComplete && (
        <div className={`rounded-xl border p-3 text-sm ${job.validation_passed
          ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400'
          : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'}`}>
          <span className="font-semibold mr-2">{job.validation_passed ? '✓ Validation Passed' : '⚠ Validation Issues'}</span>
          <span className="text-xs opacity-80">{job.validation_notes}</span>
          {!canPublish && isComplete && (
            <p className="text-xs mt-1 text-red-400">
              Needs ≥ 2 public + ≥ 10 private test cases. Got {publicTcs.length} + {privateTcs.length}.
            </p>
          )}
        </div>
      )}

      {/* Tabs (only shown when there's content) */}
      {(job.description || job.solution_code || job.tcgen_script || job.test_cases?.length > 0) && (
        <>
          <div className="flex gap-1 border-b border-gray-800">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t.key
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Problem Statement tab */}
          {tab === 'problem' && (
            <div className="space-y-4">
              {job.description && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Problem Statement</h3>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-gray-900 rounded-xl p-4 border border-gray-800">
                    {job.description}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {job.constraints && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Constraints</h3>
                    <pre className="text-gray-300 bg-gray-900 rounded-xl p-4 border border-gray-800 whitespace-pre-wrap font-mono text-xs">{job.constraints}</pre>
                  </div>
                )}
                {job.input_format && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Input Format</h3>
                    <p className="text-sm text-gray-300 bg-gray-900 rounded-xl p-4 border border-gray-800 whitespace-pre-wrap">{job.input_format}</p>
                  </div>
                )}
                {job.output_format && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Output Format</h3>
                    <p className="text-sm text-gray-300 bg-gray-900 rounded-xl p-4 border border-gray-800 whitespace-pre-wrap">{job.output_format}</p>
                  </div>
                )}
                {(job.time_complexity || job.space_complexity) && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Complexity</h3>
                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-1 text-xs font-mono">
                      <div><span className="text-gray-500">Time: </span><span className="text-emerald-400">{job.time_complexity}</span></div>
                      <div><span className="text-gray-500">Space: </span><span className="text-blue-400">{job.space_complexity}</span></div>
                      <div><span className="text-gray-500">TL: </span><span className="text-yellow-400">{job.time_limit_ms}ms</span></div>
                      <div><span className="text-gray-500">ML: </span><span className="text-orange-400">{job.memory_limit_mb}MB</span></div>
                    </div>
                  </div>
                )}
              </div>
              {job.sample_input && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sample Input</h3>
                    <CodeBlock code={job.sample_input} lang="input" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sample Output</h3>
                    <CodeBlock code={job.sample_output} lang="output" />
                  </div>
                </div>
              )}
              {job.sample_explanation && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sample Explanation</h3>
                  <p className="text-sm text-gray-300 bg-gray-900 rounded-xl p-4 border border-gray-800 whitespace-pre-wrap leading-relaxed">{job.sample_explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* Solutions tab */}
          {tab === 'solution' && (
            <div className="space-y-5">
              {job.solution_code && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Python Reference Solution</h3>
                  <CodeBlock code={job.solution_code} lang="python" />
                </div>
              )}
              {job.solution_cpp && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">C++ Reference Solution</h3>
                  <CodeBlock code={job.solution_cpp} lang="cpp" />
                </div>
              )}
            </div>
          )}

          {/* TestGen Script tab */}
          {tab === 'tcgen' && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Test Case Generator Script
                <span className="ml-2 font-normal text-gray-600">— executed in Docker sandbox to produce {(job.test_cases || []).length} test cases</span>
              </h3>
              {job.tcgen_script
                ? <CodeBlock code={job.tcgen_script} lang="python" />
                : <p className="text-sm text-gray-500 italic">Not yet generated</p>}
            </div>
          )}

          {/* Test Cases tab */}
          {tab === 'testcases' && (
            <div className="space-y-3">
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="text-emerald-400 font-medium">{publicTcs.length} public</span>
                <span className="text-gray-500">|</span>
                <span className="text-violet-400 font-medium">{privateTcs.length} private (hidden)</span>
              </div>
              {(job.test_cases || []).map((tc, i) => (
                <div key={i} className={`rounded-xl border p-3 ${tc.is_hidden ? 'border-gray-800 bg-gray-900/50' : 'border-emerald-800/40 bg-emerald-900/10'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-400">TC {i + 1}</span>
                    {!tc.is_hidden
                      ? <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">public</span>
                      : <span className="text-xs bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded border border-gray-600">private</span>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <div className="text-gray-500 mb-1">Input:</div>
                      <pre className="bg-gray-950 p-2 rounded-lg text-gray-200 overflow-x-auto max-h-28 overflow-y-auto">{tc.input}</pre>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Expected Output:</div>
                      <pre className="bg-gray-950 p-2 rounded-lg text-emerald-300 overflow-x-auto max-h-28 overflow-y-auto">{tc.expected_output}</pre>
                    </div>
                  </div>
                </div>
              ))}
              {(job.test_cases || []).length === 0 && (
                <p className="text-sm text-gray-500 italic">Test cases will appear here after Docker execution completes</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── JobRow ────────────────────────────────────────────────────────────────────
function JobRow({ job, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        active
          ? 'border-violet-500/60 bg-violet-500/10'
          : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{job.name || `Job ${job.job_id?.slice(-8)}`}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={job.status} />
            {job.difficulty && (
              <span className="text-xs font-bold" style={{ color: cfDiffColor(job.difficulty) }}>CF {job.difficulty}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(job.topics || []).slice(0, 3).map((t) => (
              <span key={t} className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{t}</span>
            ))}
          </div>
        </div>
        {job.status !== 'completed' && job.status !== 'failed' && (
          <span className="text-xs font-bold text-violet-400 shrink-0">{job.progress}%</span>
        )}
        {job.validation_passed === true && (
          <span className="text-emerald-400 text-sm shrink-0">✓</span>
        )}
        {job.validation_passed === false && (
          <span className="text-yellow-400 text-sm shrink-0">⚠</span>
        )}
      </div>
      {job.created_at && (
        <p className="text-xs text-gray-600 mt-2">{new Date(job.created_at).toLocaleString()}</p>
      )}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminProblems() {
  const [jobs, setJobs] = useState([])
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  // ── Load job list ────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/ai/jobs')
      setJobs(data.jobs || [])
    } catch {
      // silently ignore list errors
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  // ── Poll selected job ────────────────────────────────────────────────────
  const pollJob = useCallback(async (jobId) => {
    try {
      const { data } = await api.get(`/api/admin/ai/jobs/${jobId}`)
      setSelectedJob(data)
      // Update job in list too
      setJobs((prev) => prev.map((j) => j.job_id === jobId
        ? { ...j, status: data.status, progress: data.progress, name: data.name, validation_passed: data.validation_passed }
        : j))
    } catch (err) {
      if (err.response?.status !== 404) console.error('Poll error:', err.message)
    }
  }, [])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (!selectedJobId) return

    pollJob(selectedJobId)
    pollRef.current = setInterval(() => {
      pollJob(selectedJobId).then(() => {
        if (selectedJob && ['completed', 'failed'].includes(selectedJob.status)) {
          clearInterval(pollRef.current)
          loadJobs()
        }
      })
    }, 3000)

    return () => clearInterval(pollRef.current)
  }, [selectedJobId, pollJob, loadJobs])

  // Stop polling when job finishes
  useEffect(() => {
    if (selectedJob && ['completed', 'failed'].includes(selectedJob.status)) {
      clearInterval(pollRef.current)
    }
  }, [selectedJob?.status])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGenerate = async ({ topics, difficulty, idea }) => {
    setGenerating(true)
    setError(null)
    setPublishResult(null)
    try {
      const { data } = await api.post('/api/admin/ai/generate', { topics, difficulty, idea })
      const newJob = { job_id: data.job_id, status: 'queued', progress: 0, topics, difficulty, created_at: data.created_at }
      setJobs((prev) => [newJob, ...prev])
      setSelectedJobId(data.job_id)
      setSelectedJob(null)
      setShowForm(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start generation. Is ai-service running?')
    } finally {
      setGenerating(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedJob) return
    setPublishing(true)
    setPublishResult(null)
    try {
      const { data } = await api.post(`/api/admin/ai/jobs/${selectedJob.job_id}/publish`)
      setPublishResult({ success: true, slug: data.slug, title: data.title })
      loadJobs()
    } catch (err) {
      setPublishResult({ success: false, error: err.response?.data?.error || 'Publish failed' })
    } finally {
      setPublishing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedJob) return
    try {
      await api.post(`/api/admin/ai/jobs/${selectedJob.job_id}/reject`)
      setSelectedJobId(null)
      setSelectedJob(null)
      loadJobs()
    } catch { /* ignore */ }
  }

  const handleSelectJob = (jobId) => {
    setSelectedJobId(jobId)
    setPublishResult(null)
    setError(null)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Problem Factory</h1>
          <p className="text-sm text-gray-400 mt-1">
            Generate Codeforces-style problems using Groq • Multi-step agent: statement → solution → test cases → Docker validation
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setError(null) }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
          {showForm ? '✕ Cancel' : '+ Generate New Problem'}
        </button>
      </div>

      {/* Global error */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {/* Publish result */}
      {publishResult && (
        <div className={`rounded-xl border p-4 text-sm ${publishResult.success
          ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400'
          : 'bg-red-900/20 border-red-500/30 text-red-400'}`}>
          {publishResult.success
            ? `✓ Problem "${publishResult.title}" published successfully! Slug: ${publishResult.slug}`
            : `✗ ${publishResult.error}`}
        </div>
      )}

      {/* Generate form (collapsible) */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Configure Problem Generation</h2>
          <GenerateForm onSubmit={handleGenerate} loading={generating} />
        </div>
      )}

      {/* Two-column layout: job list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Job list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Jobs</h2>
            <button onClick={loadJobs} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">↻ Refresh</button>
          </div>
          {jobs.length === 0
            ? <p className="text-sm text-gray-600 italic px-2">No generation jobs yet. Click "Generate New Problem" to start.</p>
            : jobs.map((job) => (
                <JobRow
                  key={job.job_id}
                  job={job}
                  active={selectedJobId === job.job_id}
                  onClick={() => handleSelectJob(job.job_id)}
                />
              ))}
        </div>

        {/* Job detail */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 min-h-96">
          {selectedJob
            ? <JobDetail
                job={selectedJob}
                onPublish={handlePublish}
                onReject={handleReject}
                publishing={publishing}
              />
            : (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="text-5xl mb-4">🤖</div>
                <h3 className="text-lg font-semibold text-gray-300">AI Problem Factory</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-sm">
                  Select a job from the list or click "Generate New Problem" to create a CF-style problem with AI.
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Pipeline info */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">How it works</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { icon: '📝', title: '1. Problem Statement', desc: 'Groq llama-3.3-70b generates name, description, constraints, I/O format, sample cases' },
            { icon: '💻', title: '2. Reference Solutions', desc: 'llama-3.1-8b generates Python + C++ solutions with time/space complexity' },
            { icon: '🧪', title: '3. Test Case Generator', desc: '12-test-case generator script — 2 public + 10 private covering edge cases & stress tests' },
            { icon: '🐳', title: '4. Docker Validation', desc: 'Generator + solution executed in isolated Docker containers via judge-service' },
          ].map((item) => (
            <div key={item.title} className="bg-gray-800/50 rounded-xl p-3 border border-gray-700">
              <div className="text-xl mb-1">{item.icon}</div>
              <div className="font-semibold text-gray-300 mb-1">{item.title}</div>
              <div className="text-gray-500 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

