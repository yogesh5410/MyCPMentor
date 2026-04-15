import SectionStub from './SectionStub'

export default function Settings() {
  return (
    <SectionStub
      icon="⚙️"
      title="Settings"
      subtitle="Account preferences, notifications, and integrations"
      color="slate"
      description="Manage your MyCPMentor account from one place. Update display name and avatar, configure notification preferences, control privacy settings for your public profile, and manage third-party integrations like Codeforces handle and Google account linking."
      features={[
        { icon: '👤', title: 'Account Details', desc: 'Update display name, avatar, bio, and country. Changes reflect on your public profile immediately.' },
        { icon: '🔔', title: 'Notifications', desc: 'Choose which events trigger email or in-app alerts: POTD reminder, battle challenges, contest start, revision due.' },
        { icon: '🔐', title: 'Security', desc: 'Manage login methods — Google OAuth and email OTP. View active sessions and revoke any.' },
        { icon: '🌐', title: 'CF Integration', desc: 'Link or re-link your Codeforces handle. Trigger a manual CF submission sync at any time.' },
        { icon: '🎨', title: 'Appearance', desc: 'Set default theme (light/dark/system). Choose accent color for highlights across the dashboard.' },
        { icon: '🗑️', title: 'Data & Privacy', desc: 'Export your full data as JSON. Control public profile visibility. Delete account if needed.' },
      ]}
    />
  )
}
