import { Brain, Calendar, FolderOpen, Bot } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useStats } from '@/hooks/useStats'
import type { StatsResponse } from '@/types/memory'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the last non-empty segment of a filesystem path.
 * "/Users/alice/projects/my-app" → "my-app"
 * If the path is empty or has no segments, returns the full string as fallback.
 */
function lastPathSegment(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.at(-1) ?? path
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface IconBadgeProps {
  icon: LucideIcon
}

function IconBadge({ icon: Icon }: IconBadgeProps) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-cyan-900">
      <Icon className="h-4 w-4 text-brand-cyan-400" strokeWidth={1.75} />
    </div>
  )
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  /** Optional secondary line shown below the main value */
  sub?: string
}

function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {label}
          </span>
          <IconBadge icon={icon} />
        </div>

        <div>
          <p className="text-2xl font-semibold leading-none text-brand-cyan-500">
            {value}
          </p>
          {sub && (
            <p className="mt-1 truncate text-xs text-text-muted">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-2">
        {/* Label row + icon badge */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        {/* Value */}
        <div>
          <Skeleton className="h-7 w-16" />
          {/* Sub-line */}
          <Skeleton className="mt-1 h-3 w-32" />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Card definitions
// ---------------------------------------------------------------------------

/**
 * Derives the four stat card display configs from a StatsResponse.
 * Keeping this separate from JSX makes it easy to unit-test independently.
 */
function buildCardProps(stats: StatsResponse): StatCardProps[] {
  return [
    {
      icon: Brain,
      label: 'Total Memories',
      value: stats.totalMemories.toLocaleString(),
    },
    {
      icon: Calendar,
      label: 'This Week',
      value: stats.memoriesThisWeek.toLocaleString(),
    },
    {
      icon: FolderOpen,
      label: 'Top Project',
      value: lastPathSegment(stats.topProject.path) || '—',
      sub: stats.topProject.path
        ? `${stats.topProject.count.toLocaleString()} memories`
        : undefined,
    },
    {
      icon: Bot,
      label: 'Top Agent',
      value: stats.topAgent.name || '—',
      sub: stats.topAgent.name
        ? `${stats.topAgent.count.toLocaleString()} memories`
        : undefined,
    },
  ]
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

/**
 * Renders a 4-card summary grid showing key memory stats.
 * Displays skeleton placeholders while data is loading.
 * Grid reflows: 1 col mobile → 2 col tablet → 4 col desktop.
 */
export function StatsCards() {
  const { data, isLoading } = useStats()

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {buildCardProps(data).map((props) => (
        <StatCard key={props.label} {...props} />
      ))}
    </div>
  )
}
