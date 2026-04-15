import SectionStub from './SectionStub'

export default function Profile() {
  return (
    <SectionStub
      icon="👤"
      title="Profile"
      subtitle="Your public CP identity — showcase your journey"
      color="violet"
      description="Your profile is your public competitive programming identity. It shows your linked Codeforces handle, MyCPMentor rating graph, badge collection, solve heatmap, and top-solved tags. Share your profile link to flex your progress with friends and recruiters."
      features={[
        { icon: '🔗', title: 'CF Handle Linking', desc: 'Connect your Codeforces handle. All your CF submissions and rating history sync automatically.' },
        { icon: '🌟', title: 'Rating Graph', desc: 'Composite rating timeline combining CF performance + battle/contest/practice activity.' },
        { icon: '🏅', title: 'Badge Showcase', desc: 'Display earned badges: rating milestones, weekly podium finishes, streak achievements, and more.' },
        { icon: '🗓️', title: 'Solve Heatmap', desc: 'Public activity heatmap so others can see your consistency over the last year.' },
        { icon: '🏷️', title: 'Topic Mastery', desc: 'Top 5 strongest tags auto-computed from your solve history and shown on your public card.' },
        { icon: '📤', title: 'Share Card', desc: 'Export a stylized profile card image. Share on social media or your GitHub README.' },
      ]}
    />
  )
}
