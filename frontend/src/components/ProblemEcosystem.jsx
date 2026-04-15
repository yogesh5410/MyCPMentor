const cfFeatures = [
  'Industry-standard problem quality',
  'Real contest problems from rounds',
  'Difficulty-rated from 800 → 3500',
  'Used for POTD & roadmap benchmarking',
  'Trusted globally by competitive programmers',
]

const aiFeatures = [
  'RAG-powered generation pipeline',
  'Problems target your exact weak topics',
  'Unique — no internet contamination',
  'Auto-validated via execution engine',
  'Used exclusively in Battles & Practice',
]

const usageStrategy = [
  { feature: 'POTD', source: 'CF Only', badge: 'cf' },
  { feature: 'Roadmap', source: '70% CF + 30% AI', badge: 'hybrid' },
  { feature: 'Sheets', source: 'CF-heavy + some AI', badge: 'hybrid' },
  { feature: 'Battles', source: 'Internal AI Only', badge: 'ai' },
  { feature: 'Practice', source: 'AI-heavy', badge: 'ai' },
  { feature: 'Revision', source: 'Both', badge: 'hybrid' },
]

const badgeStyles = {
  cf: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  ai: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  hybrid: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
}

export default function ProblemEcosystem() {
  return (
    <section id="problems" className="py-14 px-6 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-3xl mx-auto">

        {/* Section header — centered */}
        <div className="text-center mb-10">
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-2 tracking-widest uppercase">
            Problem Ecosystem
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-3">
            Dual problem system
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
            Benchmarking via Codeforces, personalization via AI — best of both worlds.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

          {/* Codeforces card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-lg">🏆</div>
              <div>
                <div className="font-bold text-sm text-gray-900 dark:text-white">Codeforces</div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">External · Benchmarking</div>
              </div>
            </div>
            <ul className="space-y-2">
              {cfFeatures.map(f => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-gray-600 dark:text-gray-400">
                  <span className="text-emerald-500 mt-px shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>

          {/* AI card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-violet-200 dark:border-violet-900/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-lg">🤖</div>
              <div>
                <div className="font-bold text-sm text-gray-900 dark:text-white">AI-Generated</div>
                <div className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">Internal · Personalized</div>
              </div>
            </div>
            <ul className="space-y-2">
              {aiFeatures.map(f => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-gray-600 dark:text-gray-400">
                  <span className="text-emerald-500 mt-px shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Usage strategy — full-width pill table */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-500 mb-4 uppercase tracking-widest">
            Usage Strategy
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {usageStrategy.map(row => (
              <div key={row.feature} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{row.feature}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap font-medium ${badgeStyles[row.badge]}`}>
                  {row.badge.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
