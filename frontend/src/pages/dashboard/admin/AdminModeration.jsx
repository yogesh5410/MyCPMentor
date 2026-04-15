import SectionStub from '../SectionStub'

export default function AdminModeration() {
  return (
    <SectionStub
      icon="🛡️"
      title="Moderation"
      subtitle="Review reports, manage flags, and maintain platform integrity"
      color="red"
      description="Centralized moderation queue for user-reported content: discussion posts, comments, profile bios, editorial text, and battle disputes. Moderators see full context, can take action, and escalate edge cases to admins. All decisions are logged for audit."
      features={[
        { icon: '📥', title: 'Report Queue', desc: 'Prioritized list of user reports: spam, abusive language, spoiler editorials, or battle dispute claims.' },
        { icon: '💬', title: 'Discussion Moderation', desc: 'Hide, edit, or delete community posts and comments. Issue warnings to repeat offenders.' },
        { icon: '⚔️', title: 'Battle Disputes', desc: "Review contested battle outcomes. See both sides' submission timestamps, verdicts, and claimed issues." },
        { icon: '🔍', title: 'Content Audit', desc: 'Search all public content by keyword. Scan for policy violations in editorials and profile fields.' },
        { icon: '📋', title: 'Action Log', desc: 'Complete log of every moderation action: who acted, what was done, timestamp, and original content.' },
        { icon: '⚙️', title: 'Auto-Mod Rules', desc: 'Configure keyword filters and rate-limit rules that auto-flag or auto-hide content before human review.' },
      ]}
    />
  )
}
