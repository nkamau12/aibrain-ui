import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useRecentMemories } from '@/hooks/useMemories'
import { MemoryList } from '@/components/memories/MemoryList'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { TagCloud } from '@/components/dashboard/TagCloud'
import { Timeline } from '@/components/dashboard/Timeline'

export default function Dashboard() {
  const { data, isLoading, isError } = useRecentMemories({ limit: 12 })

  useEffect(() => {
    document.title = 'Dashboard — aiBrain'
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-heading">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          Your recent memories and activity at a glance
        </p>
      </div>

      {/* Stats summary */}
      <StatsCards />

      {/* Timeline chart — full width */}
      <Timeline />

      {/* Two-column layout: recent memories (wider) + tag cloud (narrower) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-4 text-base font-medium text-text-heading">
            Recent Memories
          </h2>

          {isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Failed to load memories. Check that the API server is running on
              port 3001.
            </div>
          ) : isLoading ? (
            <MemoryList isLoading={true} skeletonCount={12} />
          ) : (
            <MemoryList memories={data?.memories ?? []} />
          )}

          <Link to="/search" className="text-xs text-brand-cyan-400 hover:underline mt-2 inline-block">
            View all memories →
          </Link>
        </section>

        <aside>
          <TagCloud />
        </aside>
      </div>
    </div>
  )
}
