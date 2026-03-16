import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useTags } from '@/hooks/useTags'
import { Skeleton } from '@/components/ui/skeleton'
import type { TagCount } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHART_TAGS = 20
const AMBER_BAR_COLOR = '#ffd93d'
const AMBER_BAR_HOVER = '#ffe87a'
const CHART_HEIGHT = 300

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: TagCount; value: number }>
  label?: string
}

/**
 * Recharts calls this with `active`, `payload`, and `label`.
 * We surface tag name + exact count in the project's dark card style.
 */
function ChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const { tag, count } = payload[0].payload

  return (
    <div
      className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
      role="tooltip"
    >
      <p className="text-xs font-semibold text-brand-amber-300">{tag}</p>
      <p className="mt-0.5 text-xs text-text-muted">
        <span className="text-text-body font-medium tabular-nums">{count}</span>{' '}
        {count === 1 ? 'memory' : 'memories'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TagChartSkeleton() {
  return (
    <div
      style={{ height: CHART_HEIGHT }}
      className="flex items-end gap-1 px-6 pb-8"
      aria-hidden
    >
      {/* Simulate a rough bar chart silhouette with varying heights */}
      {[60, 45, 80, 35, 70, 55, 40, 90, 30, 65, 50, 75, 45, 85, 38].map((h, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-sm"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TagChartProps {
  /** Optionally scope chart data to a specific project */
  projectPath?: string
  /** Optionally scope chart data to a specific agent */
  agentName?: string
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TagChart({ projectPath, agentName }: TagChartProps) {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useTags(projectPath, agentName)

  function handleBarClick(entry: TagCount) {
    navigate(`/search?tags=${encodeURIComponent(entry.tag)}`)
  }

  if (isError) {
    return (
      <section
        aria-label="Tag distribution chart error"
        className="rounded-xl border border-border bg-card p-5"
        style={{ height: CHART_HEIGHT }}
      >
        <p className="text-sm text-destructive">Could not load chart data. Please try again.</p>
      </section>
    )
  }

  // Recharts bar charts need a top-level container with defined height.
  // We always render the outer section so the layout doesn't shift on load.
  const topTags = isLoading ? [] : (data?.tags ?? []).slice(0, MAX_CHART_TAGS)

  return (
    <section aria-label="Tag distribution chart" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-heading">Tag Distribution</h2>
        {!isLoading && (
          <p className="mt-0.5 text-xs text-text-muted">
            Top {topTags.length} tags by usage — click a bar to search
          </p>
        )}
      </div>

      {isLoading ? (
        <TagChartSkeleton />
      ) : topTags.length === 0 ? (
        <div
          style={{ height: CHART_HEIGHT }}
          className="flex items-center justify-center"
        >
          <p className="text-sm text-text-muted italic">No tag data yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart
            data={topTags}
            margin={{ top: 4, right: 8, left: 0, bottom: 64 }}
          >
            <XAxis
              dataKey="tag"
              tick={{ fill: '#6b6b8a', fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              interval={0}
              tickLine={false}
              axisLine={{ stroke: '#2a2a4a' }}
            />
            <YAxis
              tick={{ fill: '#6b6b8a', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
              allowDecimals={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: 'rgba(255, 217, 61, 0.08)' }}
            />
            <Bar
              dataKey="count"
              radius={[3, 3, 0, 0]}
              cursor="pointer"
              onClick={(entry: TagCount) => handleBarClick(entry)}
            >
              {topTags.map((entry) => (
                <Cell
                  key={entry.tag}
                  fill={AMBER_BAR_COLOR}
                  className="transition-all duration-150"
                  // Recharts doesn't support CSS :hover on Cell natively,
                  // so we bake a consistent amber fill; the cursor pointer
                  // communicates interactivity. The tooltip confirms the action.
                  onMouseEnter={(e: React.MouseEvent<SVGRectElement>) => {
                    ;(e.currentTarget as SVGRectElement).setAttribute('fill', AMBER_BAR_HOVER)
                  }}
                  onMouseLeave={(e: React.MouseEvent<SVGRectElement>) => {
                    ;(e.currentTarget as SVGRectElement).setAttribute('fill', AMBER_BAR_COLOR)
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  )
}
