import SectionStub from './SectionStub'

export default function AIMentor() {
  return (
    <SectionStub
      icon="🤖"
      title="AI Mentor"
      subtitle="Your personal CP coach — available 24/7"
      color="indigo"
      description="The AI Mentor is a specialized LLM assistant trained on competitive programming concepts, algorithms, and your personal performance data. Ask for hints, request solution walkthroughs, get complexity analysis, or discuss alternative approaches — all without leaving the platform."
      features={[
        { icon: '💡', title: 'Tiered Hints', desc: 'Request 3 levels of hints for any problem: direction → approach → pseudocode. Never spoil yourself.' },
        { icon: '🔍', title: 'Code Analysis', desc: 'Paste your solution and get time/space complexity analysis, bug identification, and optimization suggestions.' },
        { icon: '📚', title: 'Concept Explanations', desc: 'Ask "explain DSU" or "when to use segment trees?" — get clear, example-backed explanations.' },
        { icon: '🎯', title: 'Weakness-Aware', desc: 'Mentor prioritizes explanations in your weak topic areas automatically.' },
        { icon: '💬', title: 'Conversation History', desc: 'Full session history saved — continue a conversation about a problem days later.' },
        { icon: '⚡', title: 'Live Code Feedback', desc: 'Write code in the editor and get real-time suggestions as you type (copilot-style).' },
      ]}
    />
  )
}
