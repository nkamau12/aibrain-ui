import { format, parseISO } from 'date-fns'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { useTimeline } from '@/hooks/useStats'
import type { TimelinePoint } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cyan accent hex used for the area stroke and fill. */
const CYAN = '#00d9ff'

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadEntry {
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}

/**
 * Dark-themed tooltip that shows the full date and memory count.
 * Rendered inline so it picks up the parent component's closure without
 * needing a separate file.
 */
function TimelineTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null

  const count = payload[0]?.value ?? 0

  // label comes from XAxis as the raw ISO date string (dataKey="date")
  const formattedDate = (() => {
    try {
      return format(parseISO(label), 'MMM d, yyyy')
    } catch {
      return label
    }
  })()

  return (
    <div
      className="
        rounded-lg border border-border/60 bg-surface px-3 py-2
        text-xs shadow-xl shadow-black/40
      "
    >
      <p className="font-medium text-text-heading">{formattedDate}</p>
      <p className="mt-0.5 text-text-muted">
        <span className="font-mono text-brand-cyan-400">{count}</span>
        {' '}
        {count === 1 ? 'memory' : 'memories'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// X-axis tick formatter
// ---------------------------------------------------------------------------

/**
 * Formats an ISO date string to a short "Mar 1" label for the x-axis.
 * Returns an empty string on parse failure so Recharts omits the tick
 * rather than rendering garbage.
 */
function formatAxisDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'MMM d')
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function TimelineSkeleton() {
  return (
    <Skeleton className="h-[200px] w-full rounded-lg" />
  )
}

interface TimelineChartProps {
  data: TimelinePoint[]
}

/**
 * The chart itself, extracted so the parent can keep loading/error/empty
 * logic clean and readable.
 */
function TimelineChart({ data }: TimelineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
      >
        {/* No grid lines — cleaner sparkline aesthetic */}
        <CartesianGrid vertical={false} horizontal={false} />

        <XAxis
          dataKey="date"
          tickFormatter={formatAxisDate}
          tick={{ fontSize: 11, fill: '#6b6b8a' }}
          tickLine={false}
          axisLine={false}
          // Show ~6 evenly-spaced ticks across 30 days to avoid crowding
          interval={Math.floor(data.length / 6) || 0}
        />

        {/* Y-axis: hidden visually, still drives scale */}
        <YAxis
          hide
          allowDecimals={false}
          // Small padding at top so the area peak never clips
          domain={[0, (dataMax: number) => Math.max(dataMax, 1) + 1]}
        />

        <Tooltip
          content={<TimelineTooltip />}
          cursor={{
            stroke: CYAN,
            strokeWidth: 1,
            strokeOpacity: 0.3,
            strokeDasharray: '4 2',
          }}
        />

        <Area
          type="monotone"
          dataKey="count"
          stroke={CYAN}
          strokeWidth={2}
          fill={CYAN}
          fillOpacity={0.12}
          // Remove the default dot on each data point for a clean line
          dot={false}
          activeDot={{
            r: 4,
            fill: CYAN,
            stroke: '#1e1e36',
            strokeWidth: 2,
          }}
          isAnimationActive
          animationDuration={600}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

/**
 * Timeline section for the dashboard.
 *
 * Fetches the last 30 days of memory creation activity and renders it as a
 * smooth area chart. Zero-count days are included by the server so the
 * x-axis is always continuous.
 *
 * States handled:
 *  - Loading  → skeleton rectangle matching chart dimensions
 *  - Error    → brief error message (non-fatal, chart is optional UI)
 *  - Empty    → friendly prompt encouraging first memory creation
 *  - Data     → full Recharts AreaChart
 */
export function Timeline() {
  const { data, isLoading, isError } = useTimeline(30)

  return (
    <section aria-labelledby="timeline-heading">
      <h2
        id="timeline-heading"
        className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted"
      >
        Memory Activity
      </h2>

      {isLoading && <TimelineSkeleton />}

      {isError && !isLoading && (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-border/40 bg-surface">
          <p className="text-sm text-text-muted">
            Could not load timeline data.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-border/40 bg-surface">
          <p className="text-sm text-text-muted">
            No memories yet — create your first memory to see activity here.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="rounded-lg border border-border/40 bg-surface px-4 py-4">
          <TimelineChart data={data} />
        </div>
      )}
    </section>
  )
}
