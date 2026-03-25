import { getClusterColor } from '@/lib/cluster-colors'
import type { RelatedId } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphLegendProps {
  /** Unique cluster names present in the current graph data. */
  clusters: string[]
  className?: string
}

// ---------------------------------------------------------------------------
// Relation-type color map
//
// These colors are intentionally hardcoded (not derived from the cluster
// palette) because they encode semantic meaning in the graph edges.
// Changing them would break the visual grammar users have learned.
// ---------------------------------------------------------------------------

const RELATION_COLORS: Record<RelatedId['relation_type'], string> = {
  supersedes: '#ff6b6b',  // rose   — replaces/deprecates
  'caused-by': '#ffd93d', // amber  — causal dependency
  'see-also': '#3b82f6',  // blue   — loose reference
  'follow-up': '#10b981', // emerald — continuation
  similar: '#6b7280',     // gray   — similarity / duplicate-ish
}

const RELATION_LABELS: Record<RelatedId['relation_type'], string> = {
  supersedes: 'Supersedes',
  'caused-by': 'Caused by',
  'see-also': 'See also',
  'follow-up': 'Follow-up',
  similar: 'Similar',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface LegendDotProps {
  color: string
}

function LegendDot({ color }: LegendDotProps) {
  return (
    <span
      className="inline-block size-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}

// ---------------------------------------------------------------------------
// GraphLegend
// ---------------------------------------------------------------------------

/**
 * Floating legend overlay for the Brain Graph canvas.
 *
 * Renders two sections:
 *   1. Cluster colors — one row per cluster visible in the current data.
 *   2. Relation type colors — always shown (edges are always present when
 *      there are any related_ids in the dataset).
 *
 * Positioned at the bottom-right of the graph area via absolute positioning
 * in the parent. The semi-transparent background keeps it readable over the
 * dark canvas without obscuring the graph.
 *
 * The component is deliberately presentational — it receives the clusters list
 * from the parent (who derives it from GraphData.nodes) and calls
 * getClusterColor to resolve each color, ensuring identical color assignment
 * to the graph nodes themselves.
 */
export function GraphLegend({ clusters, className = '' }: GraphLegendProps) {
  // Nothing to show if there are no clusters and no edges to legend
  // (we always show relation types as long as the component is rendered)
  const hasClusters = clusters.length > 0

  return (
    <aside
      role="complementary"
      aria-label="Graph legend"
      className={`
        absolute bottom-4 right-4
        z-10
        min-w-[140px] max-w-[200px]
        rounded-lg border border-border/50
        bg-surface/80 backdrop-blur-sm
        px-3 py-2.5
        shadow-md
        text-xs
        ${className}
      `}
    >
      {/* ── Cluster colors ── */}
      {hasClusters && (
        <section aria-label="Cluster colors">
          <p className="mb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            Clusters
          </p>
          <ul className="space-y-1">
            {clusters.map((name) => (
              <li key={name} className="flex items-center gap-2">
                <LegendDot color={getClusterColor(name)} />
                <span
                  className="text-text-body truncate"
                  title={name}
                >
                  {name}
                </span>
              </li>
            ))}
          </ul>
          <div className="my-2 h-px bg-border/40" aria-hidden />
        </section>
      )}

      {/* ── Relation type colors ── */}
      <section aria-label="Relation type colors">
        <p className="mb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          Relations
        </p>
        <ul className="space-y-1">
          {(Object.entries(RELATION_COLORS) as Array<[RelatedId['relation_type'], string]>).map(
            ([type, color]) => (
              <li key={type} className="flex items-center gap-2">
                {/* Lines use a short bar rather than a dot to signal edge type */}
                <span
                  className="inline-block h-0.5 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="text-text-muted">{RELATION_LABELS[type]}</span>
              </li>
            ),
          )}
        </ul>
      </section>
    </aside>
  )
}
