const steps = [
  {
    number: '01',
    icon: '🔗',
    title: 'Connect Your Handle',
    description:
      'Link your Codeforces account or install our browser extension to automatically import your full submission history.',
  },
  {
    number: '02',
    icon: '🔍',
    title: 'AI Analyses You',
    description:
      'Our AI scans your submissions across 50+ topics, identifying patterns, weak areas, frequency of errors, and skill gaps.',
  },
  {
    number: '03',
    icon: '🗺️',
    title: 'Get Your Roadmap',
    description:
      'Receive a dynamic, personalized learning plan — updated continuously as your strengths evolve and gaps close.',
  },
  {
    number: '04',
    icon: '🚀',
    title: 'Practice & Battle',
    description:
      'Solve curated problems, battle competitors in real-time, and watch your unified platform rating climb.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-14 px-6">
      <div className="max-w-3xl mx-auto">

        {/* Section header — centered */}
        <div className="text-center mb-10">
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-2 tracking-widest uppercase">
            How It Works
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-3">
            From zero to{' '}
            <span className="bg-linear-to-r from-violet-500 to-emerald-400 bg-clip-text text-transparent">
              Candidate Master
            </span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
            Four steps to a completely personalized CP journey.
          </p>
        </div>

        {/* 2x2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-4 p-5 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800">
              <div className="shrink-0 w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-2xl border border-violet-200 dark:border-violet-800/50">
                {step.icon}
              </div>
              <div>
                <div className="text-[10px] font-black text-violet-400/70 tracking-widest mb-0.5">{step.number}</div>
                <h3 className="font-bold text-[15px] text-gray-900 dark:text-white mb-1">{step.title}</h3>
                <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
