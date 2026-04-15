import SectionStub from './SectionStub'

export default function Leaderboard() {
  return (
    <SectionStub
      icon="📊"
      title="Leaderboard"
      subtitle="Global and topic-specific rankings across all users"
      color="blue"
      description="See where you stand globally, among friends, or within a specific topic tag. Rankings update in real time based on the composite MyCPMentor rating formula. Compete for weekly podium spots and earn badge rewards for top finishes."
      features={[
        { icon: '🌍', title: 'Global Ranking', desc: 'Live-updating leaderboard across all registered users ranked by composite platform rating.' },
        { icon: '🏷️', title: 'Topic Leaderboards', desc: 'Separate rankings per tag — be #1 in DP or Graphs even if not #1 globally.' },
        { icon: '👥', title: 'Friends Board', desc: 'Filter to see only users you follow for contextual motivation comparison.' },
        { icon: '📅', title: 'Weekly Sprints', desc: 'Weekly mini-contest: ranked by problems solved Mon–Sun. Top 3 earn special profile badges.' },
        { icon: '📈', title: 'Rating Timeline', desc: 'Hover any user to see their rating history graph and badge collection.' },
        { icon: '🔔', title: 'Rank Alerts', desc: 'Get notified when someone overtakes your rank or when you break into the next tier.' },
      ]}
    />
  )
}
