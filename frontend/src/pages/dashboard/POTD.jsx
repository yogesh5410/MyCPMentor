import SectionStub from './SectionStub'

export default function POTD() {
  return (
    <SectionStub
      icon="📅"
      title="Problem of the Day"
      subtitle="One problem a day, every day — sourced from Codeforces"
      color="blue"
      description="Each day a new problem is selected from Codeforces based on the platform's aggregate difficulty curve. Solve it to maintain your streak, earn POTD rating points (weight: 0.5), and compete on the daily leaderboard."
      features={[
        { icon: '🏆', title: 'Daily Streak', desc: 'Consecutive solve streaks unlock bonus rating multipliers and profile badges.' },
        { icon: '💯', title: 'Difficulty-Matched', desc: 'POTD rating adjusts to match your current rating band so it\'s always a challenge.' },
        { icon: '💡', title: 'AI Hints', desc: 'Stuck? Get 3-level escalating hints without seeing the full solution.' },
        { icon: '📊', title: 'Daily Leaderboard', desc: 'Who solved it fastest today? Compare solve times with the community.' },
        { icon: '📝', title: 'Editorial Access', desc: 'After solving (or 24h), unlock the community editorial and approach discussion.' },
        { icon: '🔄', title: 'Auto-Revision', desc: 'Solved POTD problems are automatically added to your spaced revision schedule.' },
      ]}
    />
  )
}
