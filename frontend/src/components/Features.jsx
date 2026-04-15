const features = [
  {
    icon: '🧠',
    title: 'AI Mentor',
    tag: 'Core',
    description:
      'Detects your weak topics, generates a personalized roadmap, and dynamically adapts recommendations as your skills improve.',
  },
  {
    icon: '⚔️',
    title: '1v1 Battles',
    tag: 'Engagement',
    description:
      'Get matched with a peer at your rating. Solve problems faster to win points and climb the real-time leaderboard.',
  },
  {
    icon: '📊',
    title: 'Deep Analytics',
    tag: 'Insights',
    description:
      'Performance trends, error pattern detection, topic heatmaps, and time-complexity profiling across all your submissions.',
  },
  {
    icon: '🔄',
    title: 'Spaced Revision',
    tag: 'Learning',
    description:
      'SM-2 inspired scheduling ensures you revisit problems exactly when you\'re about to forget them — maximizing retention.',
  },
  {
    icon: '⚡',
    title: 'Code Execution Engine',
    tag: 'Infrastructure',
    description:
      'Docker-sandboxed runner with timeout & memory limits. Supports C++17, Java, Python 3, and more.',
  },
  {
    icon: '🤖',
    title: 'AI Problem Generation',
    tag: 'AI',
    description:
      'RAG pipeline retrieves similar problems, generates new ones with test cases, and validates them — all targeting your weak areas.',
  },
]

export default function Features() {
  return (
    <section id="features" className="py-14 px-6 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-3xl mx-auto">

        {/* Section header — centered */}
        <div className="text-center mb-10">
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-2 tracking-widest uppercase">
            Features
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-3">
            Everything you need to{' '}
            <span className="bg-linear-to-r from-violet-500 to-emerald-400 bg-clip-text text-transparent">
              dominate CP
            </span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
            A full operating system for competitive programming — not just another problem list.
          </p>
        </div>

        {/* 2-col grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(f => (
            <div
              key={f.title}
              className="group p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-violet-400/60 dark:hover:border-violet-500/50 transition-all duration-200 hover:shadow-md hover:shadow-violet-500/5 hover:-translate-y-0.5"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-[15px] text-gray-900 dark:text-white">{f.title}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                  {f.tag}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-[13px] leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
