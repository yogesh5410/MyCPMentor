import SectionStub from '../SectionStub'

export default function AdminSystem() {
  return (
    <SectionStub
      icon="🖥️"
      title="System Health"
      subtitle="Monitor microservices, queues, workers, and infrastructure metrics in real time"
      color="slate"
      description="Live operational dashboard for every backend service: API server, AI service, test runner, CF scraper, notification worker, and the message queues connecting them. See response times, error rates, queue depths, worker throughput, and cache hit rates — all in one view."
      features={[
        { icon: '📡', title: 'Service Status', desc: 'Real-time up/down status and response time for each microservice with historical uptime percentage.' },
        { icon: '📬', title: 'Queue Monitor', desc: 'Bull/Redis queue depths for test-runner jobs, AI generation jobs, and notification dispatch jobs.' },
        { icon: '⚙️', title: 'Worker Throughput', desc: 'Jobs processed per minute, average job duration, failure rate, and retry count per worker type.' },
        { icon: '🗄️', title: 'Cache Stats', desc: 'Redis hit rate, eviction count, memory usage, and key distribution for POTD, problems, and session caches.' },
        { icon: '🗃️', title: 'Database Health', desc: 'MongoDB connection pool, slow query log (>100ms), collection sizes, and index hit rate.' },
        { icon: '🚨', title: 'Alerts & Incidents', desc: 'Automated alerts when error rate exceeds threshold. Incident log with resolution notes.' },
      ]}
    />
  )
}
