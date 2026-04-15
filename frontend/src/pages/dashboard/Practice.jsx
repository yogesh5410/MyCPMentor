import SectionStub from './SectionStub'

export default function Practice() {
  return (
    <SectionStub
      icon="⚡"
      title="Practice"
      subtitle="AI-curated problem feed targeting your weakest areas"
      color="orange"
      description="Practice mode is your daily training ground. Unlike random problem sets, every problem here is selected by the AI based on your current weak topics, your solve history, and difficulty progression. Mix of Codeforces problems and AI-generated originals."
      features={[
        { icon: '🎯', title: 'AI Recommendations', desc: 'Problems are ranked by how much improving this specific area will increase your rating.' },
        { icon: '🔢', title: 'Difficulty Ladder', desc: 'Auto-adjusts: if you solve 3 in a row, difficulty steps up. Struggle? It steps down.' },
        { icon: '🤖', title: 'AI-Generated Problems', desc: 'Some problems are AI-originals — unique, never contaminated by online solutions.' },
        { icon: '📊', title: 'Topic Filter', desc: 'Force-practice a specific topic like "DP on intervals" or "2-pointer" anytime.' },
        { icon: '⏱', title: 'Timed Mode', desc: 'Practice under contest conditions with configurable timers and no hints.' },
        { icon: '📝', title: 'Solution Notes', desc: 'Write post-solve notes and tag techniques used — builds your personal knowledge base.' },
      ]}
    />
  )
}
