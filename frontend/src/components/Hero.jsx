export default function Hero() {
  return (
    <section className="relative pt-16 pb-14 px-6 overflow-hidden">

      {/* Ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-32 w-64 h-64 bg-emerald-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-semibold mb-6 border border-violet-200 dark:border-violet-800/50">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          AI-Powered · Now in Beta
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-black leading-[1.15] tracking-tight mb-4">
          Your AI-Powered
          <br />
          <span className="bg-linear-to-r from-violet-500 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
            CP Operating System
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-6 leading-relaxed">
          AI mentorship, real-time battles, deep analytics, and spaced revision — everything to go from beginner to Grandmaster.
        </p>


      </div>
    </section>
  )
}
