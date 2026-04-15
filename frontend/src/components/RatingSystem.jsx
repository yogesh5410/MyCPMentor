const weights = [
  { type: 'Contest', weight: 1.0, label: '1.0', color: 'bg-violet-500' },
  { type: 'Battle', weight: 0.8, label: '0.8', color: 'bg-blue-500' },
  { type: 'POTD', weight: 0.5, label: '0.5', color: 'bg-emerald-500' },
  { type: 'Practice', weight: 0.3, label: '0.3', color: 'bg-orange-500' },
]

export default function RatingSystem() {
  return (
    <section id="rating" className="py-14 px-6">
      <div className="max-w-3xl mx-auto">

        {/* Section header — centered */}
        <div className="text-center mb-10">
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-2 tracking-widest uppercase">
            Rating System
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-3">
            One unified rating
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
            Every activity contributes to your global rank — contests carry more weight than daily practice.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Formula — dark code block */}
          <div className="p-5 rounded-2xl bg-gray-950 border border-gray-800 font-mono text-xs">
            <div className="text-[10px] text-gray-500 mb-5 uppercase tracking-widest">Rating Formula</div>
            <div className="space-y-5">
              <div>
                <div className="text-gray-600 mb-1">{'// Expected score (Elo)'}</div>
                <div>
                  <span className="text-emerald-400">E</span>
                  <span className="text-gray-400"> = 1 / (1 + 10</span>
                  <span className="text-yellow-400">^((Opp-User)/400)</span>
                  <span className="text-gray-400">)</span>
                </div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">{'// Rating update'}</div>
                <div>
                  <span className="text-violet-400">New</span>
                  <span className="text-gray-400"> = Old + K × </span>
                  <span className="text-blue-400">W</span>
                  <span className="text-gray-400"> × (Act − E)</span>
                </div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">{'// Difficulty bonus'}</div>
                <div>
                  <span className="text-orange-400">Adj</span>
                  <span className="text-gray-400"> = Act + (Prob−User) / 1000</span>
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-gray-800 text-[10px] text-gray-600 leading-relaxed">
              Inspired by the Elo system used in chess and competitive games.
            </div>
          </div>

          {/* Weight bars */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] text-gray-500 dark:text-gray-500 mb-5 uppercase tracking-widest font-bold">
              Activity Weights
            </div>
            <div className="space-y-4">
              {weights.map(w => (
                <div key={w.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">{w.type}</span>
                    <span className="text-[13px] font-black font-mono text-gray-700 dark:text-gray-300">{w.label}×</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={`h-full ${w.color} rounded-full`} style={{ width: `${w.weight * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-5 leading-relaxed">
              Contests carry the highest weight. Battles reward active competition. POTD and Practice provide steady gains.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
