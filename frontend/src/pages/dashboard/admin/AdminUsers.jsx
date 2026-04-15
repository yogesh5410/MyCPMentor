import SectionStub from '../SectionStub'

export default function AdminUsers() {
  return (
    <SectionStub
      icon="👥"
      title="User Management"
      subtitle="Search, inspect, and manage all registered users on the platform"
      color="violet"
      description="Full CRUD control over user accounts. Search by handle, email, or CF username. View detailed activity timelines, rating history, ban history, and linked accounts. Issue warnings, temporary bans, or permanent bans. Bulk operations for mass-action on flagged accounts."
      features={[
        { icon: '🔍', title: 'Search & Filter', desc: 'Filter users by rating range, join date, country, CF link status, ban status, or role (user/admin).' },
        { icon: '👁️', title: 'User Detail View', desc: 'Full profile: submissions, battles, contests, rating timeline, CF link, login history, and IP log.' },
        { icon: '🚫', title: 'Ban / Warn', desc: 'Issue warnings, temporary bans (1d/7d/30d), or permanent bans. All actions are logged with admin ID.' },
        { icon: '🔑', title: 'Role Management', desc: 'Promote users to moderator or admin. Assign feature flags for beta access.' },
        { icon: '📊', title: 'User Growth Stats', desc: 'DAU/MAU charts, new registrations per day, churn indicators, and geographic distribution.' },
        { icon: '📧', title: 'Bulk Email', desc: 'Send targeted emails to user segments: e.g. inactive users >30 days, users without CF sync.' },
      ]}
    />
  )
}
