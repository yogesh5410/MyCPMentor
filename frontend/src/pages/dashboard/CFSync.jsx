import SectionStub from './SectionStub'

export default function CFSync() {
  return (
    <SectionStub
      icon="🔗"
      title="CF Sync"
      subtitle="Connect your Codeforces account to unlock the full MyCPMentor experience"
      color="orange"
      description="CF Sync pulls your entire Codeforces history — submissions, ratings, contests, and tags — directly into MyCPMentor. Once linked, the AI Mentor gains full context about what you've already solved, your rating graph, and your performance patterns to give hyper-personalized recommendations."
      features={[
        { icon: '🔌', title: 'One-Click Connect', desc: 'Enter your Codeforces handle and verify in seconds. No API key or OAuth needed.' },
        { icon: '📥', title: 'Full History Import', desc: 'All past submissions, verdicts, and contest results imported and indexed automatically.' },
        { icon: '🔄', title: 'Auto-Sync', desc: 'Background sync every 30 minutes keeps your solve history up to date without manual refreshes.' },
        { icon: '🧠', title: 'AI Context Boost', desc: 'AI Mentor uses your CF data to avoid recommending problems you already solved and target real gaps.' },
        { icon: '📊', title: 'CF vs MyCPMentor Stats', desc: 'Side-by-side comparison: CF rating vs MyCPMentor rating, CF solves vs total solves.' },
        { icon: '🚨', title: 'Contest Alerts', desc: 'Get notified before rounds you\'re eligible for based on your CF division and past participation.' },
      ]}
    />
  )
}
