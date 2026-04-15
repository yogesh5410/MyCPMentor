import SectionStub from './SectionStub'

export default function Problems() {
  return (
    <SectionStub
      icon="💻"
      title="Problems"
      subtitle="Browse and filter across all 10,000+ problems"
      color="violet"
      description="The Problems browser gives you access to the full problem set — Codeforces problems with live status, and our AI-generated problem library. Filter by topic, difficulty, rating range, verdict, and platform. Submit directly from the platform with instant execution."
      features={[
        { icon: '🔍', title: 'Advanced Filters', desc: 'Filter by topic tags, difficulty range, contest round, platform (CF / AI), and your verdict.' },
        { icon: '✅', title: 'Solve Tracking', desc: 'Problems you\'ve solved globally are marked — even if solved on CF directly via our browser extension.' },
        { icon: '⚡', title: 'In-Platform Execution', desc: 'Submit and run code directly here. No tab switching. Docker-sandboxed with C++17, Python, Java.' },
        { icon: '📌', title: 'Bookmarking', desc: 'Bookmark problems to revisit, add to sheets, or schedule for revision.' },
        { icon: '🔗', title: 'CF Sync', desc: 'Problems you solve on Codeforces are automatically tracked via our browser extension.' },
        { icon: '🤖', title: 'AI Problem Origin', desc: 'AI-generated problems have full generation logs — see the RAG prompt and validation results.' },
      ]}
    />
  )
}
