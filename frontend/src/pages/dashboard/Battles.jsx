import SectionStub from './SectionStub'

export default function Battles() {
  return (
    <SectionStub
      icon="⚔️"
      title="Battles"
      subtitle="1v1 real-time competitive programming duels"
      color="red"
      description="Challenge another user or get matched by rating range for a head-to-head battle. Both contestants solve the same CF problem simultaneously under a countdown. First to AC wins the round. Battles contribute to your Elo rating with weight 0.8 — a grind that builds under-pressure problem-solving speed."
      features={[
        { icon: '🎯', title: 'Smart Matchmaking', desc: 'Get matched with an opponent within ±150 of your Codeforces rating for fair, competitive duels.' },
        { icon: '⏱️', title: 'Live Countdown', desc: 'Real-time battle room: see opponent progress, submission attempts, and solve time simultaneously.' },
        { icon: '📊', title: 'Elo Impact', desc: 'Win/loss updates your platform rating using Elo with battle weight 0.8. Strategize difficulty picks.' },
        { icon: '🏆', title: 'Battle History', desc: 'Full history of every battle — opponent, problem, time, result, and rating delta.' },
        { icon: '🔥', title: 'Win Streaks', desc: 'Chain consecutive wins for streak bonuses. Streak multipliers amplify rating gains.' },
        { icon: '🤜', title: 'Challenge Friends', desc: 'Send a challenge link to any specific user for a private battle at a chosen difficulty.' },
      ]}
    />
  )
}
