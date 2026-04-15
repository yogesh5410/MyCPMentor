// Reusable placeholder for sections not yet fully built.
// Each section page imports this and passes its metadata.

import { Link } from 'react-router-dom'

export default function SectionStub({ icon, title, subtitle, description, features, color = 'violet', comingSoon = true }) {
  const colorStyles = {
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/50',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/50',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50',
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border shrink-0 ${colorStyles[color]}`}>
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{title}</h1>
            {comingSoon && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800/50">
                In Development
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed mb-8 max-w-2xl">
        {description}
      </p>

      {/* Feature preview cards */}
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-4">
        What's included
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {features.map((f, i) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <span className="text-xl shrink-0">{f.icon}</span>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">{f.title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 hover:underline"
      >
        ← Back to Overview
      </Link>
    </div>
  )
}
