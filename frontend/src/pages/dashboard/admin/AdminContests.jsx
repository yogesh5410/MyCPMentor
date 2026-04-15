import SectionStub from '../SectionStub'

export default function AdminContests() {
  return (
    <SectionStub
      icon="🏆"
      title="Contest Manager"
      subtitle="Create, schedule, and monitor platform-native contests and special events"
      color="orange"
      description="Full lifecycle management for MyCPMentor-hosted contests. Create problem sets, set scoring rules (ICPC/IOI style), manage registrations, monitor live submission queues, disqualify cheaters in real-time, and publish final standings and editorials."
      features={[
        { icon: '➕', title: 'Create Contest', desc: 'Set title, date/time, duration, rating range eligibility, problem count, and scoring style (ICPC/IOI).' },
        { icon: '📋', title: 'Problem Set Builder', desc: 'Pick problems from the bank, order by difficulty, set time/memory limits and visibility per subtask.' },
        { icon: '📡', title: 'Live Monitor', desc: 'Real-time submission feed during contest: verdicts, leaderboard movements, suspicious activity flags.' },
        { icon: '🚨', title: 'Anti-Cheat', desc: 'Flag users with identical submissions, unusual timing patterns, or VPN usage for review.' },
        { icon: '🏅', title: 'Standings & Rating', desc: 'Publish final standings, compute and apply rating deltas, and generate per-user performance report.' },
        { icon: '📢', title: 'Announcements', desc: 'Send clarifications visible to all participants during a live contest. Support markdown.' },
      ]}
    />
  )
}
