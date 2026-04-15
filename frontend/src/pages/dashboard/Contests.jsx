import SectionStub from './SectionStub'

export default function Contests() {
  return (
    <SectionStub
      icon="🏆"
      title="Contests"
      subtitle="Virtual Codeforces contests with real performance tracking"
      color="orange"
      description="Run a virtual contest on any past Codeforces round as if it were live — with the same time limit, starting at round start time. Your results are analyzed for rating delta estimation. Contests carry weight 1.0 in the MyCPMentor rating formula, making them the highest-impact activity."
      features={[
        { icon: '🕹️', title: 'Virtual Mode', desc: 'Replay any past CF Div 1/2/3/4 round virtually. Submissions are judged in real time against original test data.' },
        { icon: '📈', title: 'Rating Weight 1.0', desc: 'Strongest rating signal. Estimations closely follow actual CF Elo delta for performed rounds.' },
        { icon: '⏰', title: 'Contest Scheduling', desc: 'Schedule upcoming CF rounds. Get reminders 30 min before. Log participation after for rating update.' },
        { icon: '📋', title: 'Upsolving Queue', desc: 'All unsolved problems from each participated contest auto-land in your upsolving queue.' },
        { icon: '🔍', title: 'Deep Post-Analysis', desc: 'Time per problem, penalty comparison vs leaderboard, missed problems by difficulty tier.' },
        { icon: '🥇', title: 'Personal Records', desc: 'Track your best contest performance, highest problems solved, and fastest solve time per rating bracket.' },
      ]}
    />
  )
}
