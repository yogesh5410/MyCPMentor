import SectionStub from './SectionStub'

export default function Notifications() {
  return (
    <SectionStub
      icon="🔔"
      title="Notifications"
      subtitle="Stay on top of every contest, battle challenge, and AI insight"
      color="violet"
      description="MyCPMentor Notifications is your activity center — aggregating contest reminders, incoming battle challenges, AI Mentor weekly summaries, streak alerts, friend activity, and important platform updates into one inbox so nothing slips through the cracks."
      features={[
        { icon: '🏆', title: 'Contest Reminders', desc: 'Timely alerts before Codeforces, AtCoder, and platform contests you have registered for.' },
        { icon: '⚔️', title: 'Battle Challenges', desc: 'Receive and accept real-time battle requests from friends or matchmade opponents.' },
        { icon: '🤖', title: 'AI Weekly Summary', desc: 'Every Monday, your AI Mentor sends a digest: wins, misses, and 3 specific actions for the week.' },
        { icon: '🔥', title: 'Streak Alerts', desc: 'Daily nudge when your solve streak is at risk, and a celebration when you hit milestones.' },
        { icon: '👥', title: 'Friend Activity', desc: 'Notify when a friend moves up the leaderboard or completes a hard problem you bookmarked.' },
        { icon: '⚙️', title: 'Notification Controls', desc: 'Granular toggle for each notification category — email, push, and in-app preferences.' },
      ]}
    />
  )
}
