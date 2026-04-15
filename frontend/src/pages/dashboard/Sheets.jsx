import SectionStub from './SectionStub'

export default function Sheets() {
  return (
    <SectionStub
      icon="📋"
      title="Sheets"
      subtitle="Curated problem lists — platform-provided and custom"
      color="emerald"
      description="Sheets are ordered problem lists for focused topic study. The platform provides curated sheets for common interview topics and CP rating milestones. You can also create your own sheets, add any problem from the library, and share them with the community."
      features={[
        { icon: '📚', title: 'Platform Sheets', desc: 'Pre-built sheets: Striver A2Z, CF Div3 mastery, Graph theory, DP foundations, and more.' },
        { icon: '✏️', title: 'Custom Sheets', desc: 'Create your own sheets. Add any CF problem or AI problem. Drag to reorder.' },
        { icon: '📊', title: 'Progress Tracking', desc: 'See completion % per sheet. Solved problems are auto-checked even if done outside the sheet.' },
        { icon: '🔗', title: 'Share & Import', desc: 'Share sheet links publicly. Import community sheets made by others.' },
        { icon: '🎯', title: 'Difficulty Distribution', desc: 'Visual breakdown of difficulty spread in any sheet before you start.' },
        { icon: '🔄', title: 'Auto-Revision', desc: 'Mark sheet problems for revision — the spaced repetition engine picks them up automatically.' },
      ]}
    />
  )
}
