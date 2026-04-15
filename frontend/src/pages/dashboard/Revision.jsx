import SectionStub from './SectionStub'

export default function Revision() {
  return (
    <SectionStub
      icon="🔄"
      title="Revision"
      subtitle="SM-2 spaced repetition — never forget a technique again"
      color="violet"
      description="Every problem you solve gets a confidence rating. The SM-2 spaced repetition algorithm schedules the optimal time to revisit it — easy problems come back less often, hard ones more. Consistent revision builds rock-solid pattern recognition for interviews and contests."
      features={[
        { icon: '🧠', title: 'SM-2 Algorithm', desc: 'Scientifically proven spaced repetition: intervals grow as you consistently recall a concept correctly.' },
        { icon: '📅', title: 'Daily Queue', desc: 'See exactly how many problems are due today. Clearing your queue earns streak points.' },
        { icon: '⭐', title: 'Confidence Rating', desc: 'After solving, rate your confidence (1–5). Low confidence → shorter re-visit interval.' },
        { icon: '📈', title: 'Retention Heatmap', desc: 'Visual calendar heatmap showing revision activity and memory retention score over time.' },
        { icon: '🏷️', title: 'Tag-Based Grouping', desc: 'Review problems by tag (DP, Graphs, etc.) for focused technique drilling sessions.' },
        { icon: '🔥', title: 'Streak Protection', desc: 'Keep your revision streak alive. Miss a day and the queue grows — stay consistent to shrink it.' },
      ]}
    />
  )
}
