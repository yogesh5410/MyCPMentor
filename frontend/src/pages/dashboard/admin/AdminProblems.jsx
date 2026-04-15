import SectionStub from '../SectionStub'

export default function AdminProblems() {
  return (
    <SectionStub
      icon="🗄️"
      title="Problem Bank"
      subtitle="Manage, curate, and enrich CF and AI-generated problems across the platform"
      color="emerald"
      description="Central admin interface for the entire problem pool. Review AI-generated problems before they go live, sync new CF problems from the scraper pipeline, edit tags/difficulty/editorials, flag duplicates, and control which problems surface in POTD, Sheets, and Practice recommendations."
      features={[
        { icon: '🤖', title: 'AI Problem Queue', desc: 'Review pending AI-generated problems. Approve, reject, or edit before they become available to users.' },
        { icon: '🔄', title: 'CF Sync Status', desc: 'Monitor the CF scraper pipeline — last sync time, problems fetched, errors, and retry queue.' },
        { icon: '🏷️', title: 'Tag & Difficulty Editor', desc: 'Mass-edit tags and difficulty ratings. Merge duplicate tags (e.g. "dp" vs "dynamic programming").' },
        { icon: '📝', title: 'Editorial Management', desc: 'Attach, edit, or flag editorials. Link to official CF editorial or write a custom one.' },
        { icon: '📅', title: 'POTD Scheduler', desc: 'Manually override or approve the AI-scheduled POTD for each difficulty level up to 7 days ahead.' },
        { icon: '📊', title: 'Problem Analytics', desc: 'Solve rate, average attempts, tag distribution, and engagement metrics per problem.' },
      ]}
    />
  )
}
