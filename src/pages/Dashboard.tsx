import { useRecentMemories } from '@/hooks/useMemories'
import { MemoryList } from '@/components/memories/MemoryList'
import { StatsCards } from '@/components/dashboard/StatsCards'

export default function Dashboard() {
  const { data, isLoading, isError } = useRecentMemories({ limit: 12 })

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-heading">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          Your recent memories and activity at a glance
        </p>
      </div>

      {/* Stats summary */}
      <StatsCards />

      {/* Recent memories section */}
      <section>
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
      </section>
    </div>
  )
}
