import SectionStub from './SectionStub'

export default function CreateProblem() {
  return (
    <SectionStub
      icon="✍️"
      title="Create Problem"
      subtitle="Submit your own competitive programming problem"
      color="emerald"
      description="Create custom problems for the community. Define problem statements, constraints, test cases, and solution approaches. Your problems will be reviewed by our admin team before being added to the platform."
      features={[
        { icon: '📝', title: 'Problem Statement', desc: 'Write clear problem descriptions with examples and constraints.' },
        { icon: '🧪', title: 'Test Cases', desc: 'Define sample inputs and expected outputs.' },
        { icon: '✅', title: 'Solution Validation', desc: 'Add reference solutions and verify correctness.' },
        { icon: '🔍', title: 'Admin Review', desc: 'Problems are reviewed for quality, clarity, and correctness.' },
        { icon: '📊', title: 'Analytics', desc: 'Track how many users solved your problems.' },
        { icon: '🏆', title: 'Credits', desc: 'Earn coins and badges for high-quality submissions.' },
      ]}
    />
  )
}
