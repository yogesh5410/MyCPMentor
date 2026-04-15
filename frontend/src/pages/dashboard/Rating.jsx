import SectionStub from './SectionStub'

export default function Rating() {
  return (
    <SectionStub
      icon="⭐"
      title="My Rating"
      subtitle="Your live MyCPMentor composite rating — earned, not guessed"
      color="yellow"
      description="MyCPMentor Rating is a multi-factor score that weighs your solve speed, difficulty range, contest performance, battle wins, and revision consistency. Unlike a raw AC count, it captures the quality and diversity of your practice — giving you a single number that actually reflects your CP maturity."
      features={[
        { icon: '📊', title: 'Composite Score', desc: 'A weighted blend of speed, difficulty, battles, contests, and revision — updated after every session.' },
        { icon: '📈', title: 'Rating History', desc: 'Timeline chart of your rating evolution. See the exact events that moved you up or down.' },
        { icon: '🏅', title: 'Rank & Percentile', desc: 'Global and country-specific rank. Know where you stand among all MyCPMentor users.' },
        { icon: '🎯', title: 'Next Milestone', desc: 'AI-calculated ETA to your next rating tier based on your current pace and weak spots.' },
        { icon: '⚖️', title: 'Factor Breakdown', desc: 'Visual pie chart showing how each activity category contributes to your score this week.' },
        { icon: '🤝', title: 'CF Rating Overlay', desc: 'Compare your MyCPMentor rating trajectory against your Codeforces rating on a single chart.' },
      ]}
    />
  )
}
