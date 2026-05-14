import SectionStub from './SectionStub'

export default function MyRequests() {
  return (
    <SectionStub
      icon="📋"
      title="My Requests"
      subtitle="Track your problem creation requests"
      color="blue"
      description="View all your submitted problem requests and their current status. Monitor the review process and get notified when your problems are approved and published to the platform."
      features={[
        { icon: '⏳', title: 'Status Tracking', desc: 'Real-time status of your problem submissions.' },
        { icon: '📝', title: 'Request Details', desc: 'View the full details of each submission.' },
        { icon: '💬', title: 'Admin Feedback', desc: 'Receive detailed feedback from the review team.' },
        { icon: '📈', title: 'Performance', desc: 'See statistics about solved problems.' },
        { icon: '🔄', title: 'Resubmit', desc: 'Make changes and resubmit if needed.' },
        { icon: '✅', title: 'Published', desc: 'Track which requests have been published.' },
      ]}
    />
  )
}
