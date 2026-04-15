import SectionStub from './SectionStub'

export default function Community() {
  return (
    <SectionStub
      icon="🌐"
      title="Community"
      subtitle="Connect, discuss, and grow with fellow CP enthusiasts"
      color="emerald"
      description="MyCPMentor Community is your social layer — find friends, form study groups, discuss problem solutions in threaded forums, and share resources. The leaderboard and battle system get more meaningful when you're competing against people you know and respect."
      features={[
        { icon: '👥', title: 'Friends & Groups', desc: 'Add friends by handle, see their recent activity, and create private study groups with shared sheets.' },
        { icon: '💬', title: 'Problem Discussions', desc: 'Threaded discussion under every problem — ask for hints, share editorial insights, no spoilers by default.' },
        { icon: '📢', title: 'Public Profiles', desc: 'Shareable profile page with rating history, tag heatmap, and trophy showcase.' },
        { icon: '🏫', title: 'Study Groups', desc: 'Create or join groups with shared roadmaps, collaborative sheets, and group leaderboards.' },
        { icon: '📝', title: 'Blog / Tips', desc: 'Community-driven blog: post your editorial, template, or CP tip and earn upvotes.' },
        { icon: '🎖️', title: 'Mentorship', desc: 'High-rated users can opt into mentorship — matched with beginners based on tag overlap and goals.' },
      ]}
    />
  )
}
