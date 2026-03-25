import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { useStats } from '@/hooks/useStats'
import { getClusterColor } from '@/lib/cluster-colors'
import type { ClusterCount } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum clusters shown before the rest are truncated. */
const MAX_CLUSTERS = 12

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadEntry {
  value: number
  payload: ClusterCount
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
}

/**
 * Dark-themed tooltip showing cluster name and exact memory count.
 * Mirrors the style used by the Timeline tooltip for visual consistency.
 */
function ClusterTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const { name, count } = payload[0].payload

  return (
    <div
      className="
        rounded-lg border border-border/60 bg-surface px-3 py-2
        text-xs shadow-xl shadow-black/40
      "
    >
      <p className="font-medium text-text-heading">{name}</p>
      <p className="mt-0.5 text-text-muted">
        <span className="font-mono text-brand-cyan-400">{count}</span>
        {' '}
        {count === 1 ? 'memory' : 'memories'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ClusterBreakdownSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-24 shrink-0 rounded" />
          <Skeleton
            className="h-4 rounded"
            style={{ width: `${60 - i * 10}%` }}
          />
        </div>
      ))}
    </div>
  )
}

function ClusterBreakdownEmpty() {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-lg border border-border/40 bg-surface">
      <p className="text-sm text-text-muted">
        No clusters yet — tag your memories with a cluster to see the breakdown.
      </p>
    </div>
  )
}

interface ClusterChartProps {
  data: ClusterCount[]
}

/**
 * Horizontal bar chart mapping each cluster to a count.
 *
 * Horizontal orientation is deliberate: cluster names are typically long
 * kebab-case strings that would overlap on a vertical x-axis.
 */
function ClusterChart({ data }: ClusterChartProps) {
  // Chart height scales with the number of bars so each bar has breathing
  // room, with a minimum to avoid an overly compact single-item chart.
  const chartHeight = Math.max(data.length * 36, 120)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
        barCategoryGap="30%"
      >
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: '#6b6b8a' }}
          tickLine={false}
          axisLine={false}
          // Small padding at the right so the longest bar label never clips
          domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
        />

        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 11, fill: '#a0a0b8' }}
          tickLine={false}
          axisLine={false}
          // Truncate long names with an ellipsis so narrow viewports stay clean
          tickFormatter={(name: string) =>
            name.length > 16 ? `${name.slice(0, 15)}…` : name
          }
        />

        <Tooltip
          content={<ClusterTooltip />}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />

        <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={500}>
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={getClusterColor(entry.name)}
              fillOpacity={entry.name === 'unclustered' ? 0.5 : 0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

/**
 * Cluster Breakdown section for the dashboard.
 *
 * Reads the `clusters` field from the /api/stats response (already fetched by
 * useStats — no extra network request) and renders a horizontal bar chart
 * coloured by cluster name via getClusterColor().
 *
 * States handled:
 *  - Loading  → skeleton bars matching chart dimensions
 *  - Error    → inline error message
 *  - Empty    → prompt explaining how clusters work
 *  - Data     → Recharts horizontal BarChart, capped at MAX_CLUSTERS entries
 */
export function ClusterBreakdown() {
  const { data, isLoading, isError } = useStats()

  return (
    <section aria-labelledby="cluster-breakdown-heading">
      <h2
        id="cluster-breakdown-heading"
        className="mb-4 text-base font-medium text-text-heading"
      >
        Clusters
      </h2>

      {isLoading && <ClusterBreakdownSkeleton />}

      {isError && !isLoading && (
        <div className="flex h-[120px] items-center justify-center rounded-lg border border-border/40 bg-surface">
          <p className="text-sm text-text-muted">
            Could not load cluster data.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.clusters.length === 0 && (
        <ClusterBreakdownEmpty />
      )}

      {!isLoading && !isError && data && data.clusters.length > 0 && (
        <div className="rounded-lg border border-border/40 bg-surface px-4 py-4">
          <ClusterChart data={data.clusters.slice(0, MAX_CLUSTERS)} />
          {data.clusters.length > MAX_CLUSTERS && (
            <p className="mt-2 text-xs text-text-muted text-right">
              Showing top {MAX_CLUSTERS} of {data.clusters.length} clusters
            </p>
          )}
        </div>
      )}
    </section>
  )
}
