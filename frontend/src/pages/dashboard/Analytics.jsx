import SectionStub from './SectionStub'

export default function Analytics() {
  return (
    <SectionStub
      icon="📈"
      title="Analytics"
      subtitle="Deep performance insights to identify and fix your blind spots"
      color="indigo"
      description="Analytics aggregates every solve, battle, contest, and revision session into actionable signals. Heatmaps, tag-level accuracy charts, and error-pattern breakdowns tell you exactly where to focus next — turning raw effort into deliberate, targeted improvement."
      features={[
        { icon: '🗓️', title: 'Activity Heatmap', desc: 'GitHub-style calendar heatmap of daily solve activity. Spot consistency gaps at a glance.' },
        { icon: '🏷️', title: 'Tag Accuracy', desc: 'Per-tag accuracy bars: submission AC rate across every topic you have attempted.' },
        { icon: '⏱️', title: 'Speed Trends', desc: 'Average time-to-solve trend over 30/90 days per difficulty bracket: are you getting faster?' },
        { icon: '❌', title: 'Error Patterns', desc: 'Common mistake categories (TLE, WA, MLE) charted over time — reduce repeated blunders.' },
        { icon: '📊', title: 'Rating Trajectory', desc: 'Composite rating chart with CF + MyCPMentor overlay. Forecast your next milestone.' },
        { icon: '🤖', title: 'AI Insight Cards', desc: 'Weekly AI-generated insight: "You improve fastest on Graphs in the morning — schedule those then."' },
      ]}
    />
  )
}
