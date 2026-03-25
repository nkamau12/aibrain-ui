/**
 * Deterministic color assignment for cluster names.
 *
 * We map each cluster name to one of five CSS custom properties
 * (--chart-1 … --chart-5) that are already defined by the design system.
 * Using the remainder of a simple string hash keeps the assignment stable
 * across re-renders and page refreshes without requiring a lookup table.
 *
 * "unclustered" is always pinned to a muted neutral so it reads as
 * secondary information rather than competing with named clusters.
 */

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
] as const

/** Muted tone reserved for memories that carry no cluster label. */
const UNCLUSTERED_COLOR = 'hsl(var(--muted-foreground) / 0.5)'

/**
 * Returns a stable chart color for a given cluster name.
 *
 * @example
 * getClusterColor('auth-system')   // → "hsl(var(--chart-3))" (deterministic)
 * getClusterColor('unclustered')   // → "hsl(var(--muted-foreground) / 0.5)"
 */
export function getClusterColor(clusterName: string): string {
  if (clusterName === 'unclustered') {
    return UNCLUSTERED_COLOR
  }

  // djb2-inspired hash — fast, well-distributed for short strings
  let hash = 5381
  for (let i = 0; i < clusterName.length; i++) {
    hash = (hash * 33) ^ clusterName.charCodeAt(i)
  }

  return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length]
}
