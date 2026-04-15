import SectionStub from './SectionStub'

export default function Roadmap() {
  return (
    <SectionStub
      icon="🗺️"
      title="Personalized Roadmap"
      subtitle="AI-generated learning path tailored to your specific weaknesses"
      color="violet"
      description="Your roadmap is built by analyzing all your past submissions across 50+ algorithm topics. The AI mentor scores each topic, detects weak areas, and assembles a step-by-step path with a 70% Codeforces / 30% AI-generated problem mix. The roadmap dynamically updates as you improve."
      features={[
        { icon: '🧠', title: 'Weakness Detection', desc: 'AI scans your submission history to identify exactly where you lose points and time.' },
        { icon: '📈', title: 'Dynamic Updates', desc: 'Roadmap re-evaluates after every 5 problems solved — not a static list.' },
        { icon: '🏷', title: '50+ Topics Covered', desc: 'From arrays & sorting to advanced DP, segment trees, flows, and string algorithms.' },
        { icon: '⚖️', title: '70/30 Problem Mix', desc: '70% Codeforces problems for benchmarking, 30% AI-generated for personalized gaps.' },
        { icon: '📅', title: 'Time Estimates', desc: 'Each milestone shows an estimated completion time based on your solving pace.' },
        { icon: '🎯', title: 'Target Rating', desc: 'Set a target rating (e.g. 1800, 2000, CM) and the roadmap paths you toward it.' },
      ]}
    />
  )
}
