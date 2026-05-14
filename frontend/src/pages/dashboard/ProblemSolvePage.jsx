/**
 * ProblemSolvePage.jsx
 *
 * Full-screen problem solving page: left panel = problem statement,
 * right panel = Monaco code editor + Run/Submit + output.
 *
 * Route: /dashboard/problems/:slug
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import api from '../../lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: 'cpp', label: 'C++ 17' },
  { value: 'python', label: 'Python 3' },
  { value: 'javascript', label: 'JavaScript' },
]

const MONACO_LANG = { cpp: 'cpp', python: 'python', javascript: 'javascript' }

const DEFAULT_CODE = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Your code here
    
    return 0;
}`,
  python: `import sys
input = sys.stdin.readline

def main():
    # Your code here
    pass

if __name__ == "__main__":
    main()`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');
let idx = 0;

// Your code here
`,
}

const DIFF_COLOR = {
  easy: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  hard: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const VERDICT_STYLE = {
  AC: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  Accepted: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  WA: 'text-red-400 bg-red-400/10 border-red-400/30',
  'Wrong Answer': 'text-red-400 bg-red-400/10 border-red-400/30',
  TLE: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  'Time Limit Exceeded': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  RE: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  'Runtime Error': 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  CE: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  'Compile Error': 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  MLE: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
}

function verdictStyle(v) {
  return VERDICT_STYLE[v] || 'text-white/60 bg-white/5 border-white/10'
}

// ── Helper components ─────────────────────────────────────────────────────────

function Badge({ label, colorClass }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  )
}

function SH({ children }) {
  return (
    <h4 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">
      {children}
    </h4>
  )
}

function CodeBlock({ code }) {
  return (
    <pre className="bg-black/40 border border-white/8 rounded-lg p-3 text-xs font-mono text-green-300 overflow-x-auto whitespace-pre-wrap">
      {code || '(empty)'}
    </pre>
  )
}

// ── Left panel: problem statement ─────────────────────────────────────────────

function ProblemPanel({ problem }) {
  const [tab, setTab] = useState('statement')

  const tabs = [
    { id: 'statement', label: 'Statement' },
    { id: 'io', label: 'I/O Format' },
    { id: 'examples', label: 'Examples' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Title + meta */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-white/8">
        <h2 className="text-base font-semibold text-white leading-snug">{problem.title}</h2>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge
            label={problem.difficulty}
            colorClass={DIFF_COLOR[problem.difficulty] || DIFF_COLOR.medium}
          />
          <span className="text-xs text-white/40">{problem.timeLimitMs} ms</span>
          <span className="text-xs text-white/40">{problem.memoryLimitMb} MB</span>
          {problem.tags?.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 text-[10px] rounded-full bg-white/5 text-white/40 border border-white/10"
            >
              {t}
            </span>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex mt-3 overflow-x-auto -mb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                tab === t.id
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-white/50 hover:text-white/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
        {tab === 'statement' && (
          <>
            <div>
              <SH>Problem Statement</SH>
              <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {problem.description}
              </div>
            </div>

            {problem.constraints && (
              <div>
                <SH>Constraints</SH>
                <div className="text-sm text-white/70 whitespace-pre-wrap bg-white/3 rounded-lg p-3 border border-white/8">
                  {problem.constraints}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                ['Time Limit', `${problem.timeLimitMs} ms`],
                ['Memory Limit', `${problem.memoryLimitMb} MB`],
                problem.optimalTimeComplexity && ['Optimal Time', problem.optimalTimeComplexity],
                problem.optimalSpaceComplexity && ['Optimal Space', problem.optimalSpaceComplexity],
              ]
                .filter(Boolean)
                .map(([label, value]) => (
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

        {tab === 'io' && (
          <>
            {problem.inputFormat && (
              <div>
                <SH>Input Format</SH>
                <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
                  {problem.inputFormat}
                </div>
              </div>
            )}
            {problem.outputFormat && (
              <div>
                <SH>Output Format</SH>
                <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
                  {problem.outputFormat}
                </div>
              </div>
            )}
            {!problem.inputFormat && !problem.outputFormat && (
              <p className="text-sm text-white/30">No I/O format available.</p>
            )}
          </>
        )}

        {tab === 'examples' && (
          <>
            {problem.sampleInput || problem.sampleOutput ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <SH>Sample Input</SH>
                    <CodeBlock code={problem.sampleInput} />
                  </div>
                  <div>
                    <SH>Sample Output</SH>
                    <CodeBlock code={problem.sampleOutput} />
                  </div>
                </div>
                {problem.sampleExplanation && (
                  <div>
                    <SH>Explanation</SH>
                    <div className="text-sm text-white/70 whitespace-pre-wrap bg-white/3 rounded-lg p-3 border border-white/8">
                      {problem.sampleExplanation}
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {problem.publicTests?.length > 0 && (
              <div>
                <SH>Public Test Cases</SH>
                {problem.publicTests.map((tc, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Input #{i + 1}</p>
                      <CodeBlock code={tc.input} />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Expected #{i + 1}</p>
                      <CodeBlock code={tc.expected_output || tc.output} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!problem.sampleInput && !problem.sampleOutput && !problem.publicTests?.length && (
              <p className="text-sm text-white/30">No examples available.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Test result row ───────────────────────────────────────────────────────────

function TestResultRow({ result, isHidden }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-white/8 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/3 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">Test #{result.test_case_index + 1}</span>
          {isHidden && (
            <span className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded">
              hidden
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {result.time_ms != null && (
            <span className="text-xs text-white/30">{result.time_ms.toFixed(0)} ms</span>
          )}
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${verdictStyle(result.verdict)}`}
          >
            {result.verdict}
          </span>
          <span className="text-white/30 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && !isHidden && (
        <div className="px-4 pb-3 space-y-2 border-t border-white/8 bg-black/20">
          {result.stdout != null && (
            <div className="mt-3">
              <p className="text-[10px] text-white/30 mb-1">Your Output</p>
              <pre className="text-xs font-mono text-white/70 bg-black/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {result.stdout || '(no output)'}
              </pre>
            </div>
          )}
          {result.expected != null && (
            <div>
              <p className="text-[10px] text-white/30 mb-1">Expected</p>
              <pre className="text-xs font-mono text-emerald-300/70 bg-black/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {result.expected}
              </pre>
            </div>
          )}
          {result.stderr && (
            <div>
              <p className="text-[10px] text-red-400/60 mb-1">Stderr</p>
              <pre className="text-xs font-mono text-red-300/70 bg-black/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {result.stderr}
              </pre>
            </div>
          )}
        </div>
      )}
      {open && isHidden && (
        <div className="px-4 py-3 border-t border-white/8 bg-black/20">
          <p className="text-xs text-white/30">Test case details are hidden.</p>
          {result.stderr && (
            <div className="mt-2">
              <p className="text-[10px] text-red-400/60 mb-1">Stderr</p>
              <pre className="text-xs font-mono text-red-300/70 bg-black/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {result.stderr}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Output panel ──────────────────────────────────────────────────────────────

function OutputPanel({ result, mode }) {
  if (!result) return null

  const isSubmit = mode === 'submit'

  return (
    <div className="flex flex-col gap-3">
      {/* Overall verdict */}
      <div
        className={`flex items-center justify-between px-4 py-3 rounded-lg border ${verdictStyle(result.verdict)}`}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">{result.verdict}</span>
          <span className="text-xs opacity-70">
            {result.passed_tests}/{result.total_tests} tests passed
          </span>
        </div>
        {result.time_ms != null && (
          <span className="text-xs opacity-60">{result.time_ms.toFixed(0)} ms</span>
        )}
      </div>

      {/* Compile error */}
      {result.compile_error && (
        <div className="border border-violet-400/30 rounded-lg bg-violet-400/5 p-3">
          <p className="text-xs text-violet-400 font-semibold mb-1">Compile Error</p>
          <pre className="text-xs font-mono text-violet-300/80 whitespace-pre-wrap overflow-x-auto">
            {result.compile_error}
          </pre>
        </div>
      )}

      {/* Per-test results */}
      {result.test_results?.length > 0 && (
        <div className="space-y-1.5">
          {result.test_results.map((tr) => (
            <TestResultRow key={tr.test_case_index} result={tr} isHidden={isSubmit} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProblemSolvePage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [problem, setProblem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [language, setLanguage] = useState('cpp')
  const [code, setCode] = useState(DEFAULT_CODE['cpp'])
  const codeRef = useRef(DEFAULT_CODE['cpp'])

  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [submitResult, setSubmitResult] = useState(null)
  const [activeResult, setActiveResult] = useState(null) // 'run' | 'submit' | null

  // Fetch problem
  useEffect(() => {
    setLoading(true)
    setError('')
    api
      .get(`/api/problems/${slug}`)
      .then((r) => setProblem(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Problem not found'))
      .finally(() => setLoading(false))
  }, [slug])

  // Keep codeRef in sync so we can read latest value in run/submit handlers
  const handleCodeChange = (value) => {
    codeRef.current = value ?? ''
    setCode(value ?? '')
  }

  const handleLanguageChange = (lang) => {
    setLanguage(lang)
    // Only reset code if user hasn't typed yet (code equals a default)
    const isDefault = Object.values(DEFAULT_CODE).includes(codeRef.current)
    if (isDefault) {
      const fresh = DEFAULT_CODE[lang]
      codeRef.current = fresh
      setCode(fresh)
    }
  }

  const handleRun = async () => {
    if (running || submitting) return
    setRunning(true)
    setRunResult(null)
    setActiveResult('run')
    try {
      const { data } = await api.post('/api/judge/run', {
        slug,
        code: codeRef.current,
        language,
      })
      setRunResult(data)
    } catch (e) {
      setRunResult({ verdict: 'Error', total_tests: 0, passed_tests: 0, compile_error: e.response?.data?.error || 'Request failed' })
    } finally {
      setRunning(false)
    }
  }

  const handleSubmit = async () => {
    if (running || submitting) return
    setSubmitting(true)
    setSubmitResult(null)
    setActiveResult('submit')
    try {
      const { data } = await api.post('/api/judge/submit', {
        slug,
        code: codeRef.current,
        language,
      })
      setSubmitResult(data)
    } catch (e) {
      setSubmitResult({ verdict: 'Error', total_tests: 0, passed_tests: 0, compile_error: e.response?.data?.error || 'Request failed' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        Loading problem…
      </div>
    )
  }

  if (error || !problem) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-400">{error || 'Problem not found'}</p>
        <button
          onClick={() => navigate('/dashboard/problems')}
          className="px-4 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white cursor-pointer"
        >
          ← Back to Problems
        </button>
      </div>
    )
  }

  const displayResult = activeResult === 'run' ? runResult : submitResult

  return (
    <div className="flex h-[calc(100vh-80px)] min-h-0 overflow-hidden">
      {/* ── Left: Problem Statement (40%) ─────────────────────────────────── */}
      <div className="w-[40%] min-w-0 border-r border-white/8 flex flex-col min-h-0">
        {/* Back nav */}
        <div className="shrink-0 px-4 pt-3 pb-0">
          <button
            onClick={() => navigate('/dashboard/problems')}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
          >
            ← Problems
          </button>
        </div>
        <ProblemPanel problem={problem} />
      </div>

      {/* ── Right: Editor + Controls (60%) ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-white/8 bg-black/20">
          {/* Language selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/60 cursor-pointer"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value} className="bg-gray-900">
                {l.label}
              </option>
            ))}
          </select>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRun}
              disabled={running || submitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {running ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running…
                </>
              ) : (
                '▶ Run'
              )}
            </button>
            <button
              onClick={handleSubmit}
              disabled={running || submitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                '↑ Submit'
              )}
            </button>
          </div>
        </div>

        {/* Editor area — fills remaining height above output */}
        <div
          className="flex-1 min-h-0 overflow-hidden"
          style={{ height: displayResult ? '55%' : '100%' }}
        >
          <Editor
            height="100%"
            language={MONACO_LANG[language]}
            value={code}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: 'on',
              lineNumbersMinChars: 3,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>

        {/* Output panel */}
        {displayResult && (
          <div className="shrink-0 border-t border-white/8 bg-black/30 overflow-y-auto"
               style={{ maxHeight: '45%' }}>
            {/* Output header with tabs */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveResult('run')}
                  disabled={!runResult}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                    activeResult === 'run'
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:text-white/70 disabled:opacity-20'
                  }`}
                >
                  Run Result
                </button>
                <button
                  onClick={() => setActiveResult('submit')}
                  disabled={!submitResult}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                    activeResult === 'submit'
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:text-white/70 disabled:opacity-20'
                  }`}
                >
                  Submit Result
                </button>
              </div>
              <button
                onClick={() => {
                  setActiveResult(null)
                  setRunResult(null)
                  setSubmitResult(null)
                }}
                className="text-white/30 hover:text-white/70 text-xs cursor-pointer"
              >
                ✕ Clear
              </button>
            </div>
            <div className="p-4">
              <OutputPanel result={displayResult} mode={activeResult} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
