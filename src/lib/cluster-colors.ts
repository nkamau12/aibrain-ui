/**
 * Deterministic cluster-to-color mapping for memory card indicators.
 *
 * Colors are chosen to be visually distinct on dark backgrounds and align
 * with the existing chart palette from the design system. The same cluster
 * name always resolves to the same color — order within the palette is stable
 * and the palette itself should only ever be appended to, never reordered.
 */

const CLUSTER_PALETTE = [
  '#00d9ff', // cyan   (chart-1)
  '#ffd93d', // amber  (chart-2)
  '#ff6b6b', // rose   (chart-3)
  '#a855f7', // purple (chart-4)
  '#3b82f6', // blue   (chart-5)
  '#10b981', // emerald
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#06b6d4', // sky
  '#84cc16', // lime
] as const

/**
 * Maps a cluster name to a stable color from the palette.
 *
 * Uses a simple additive character-code hash to produce a palette index.
 * This is intentionally not cryptographically strong — we only need
 * uniform-ish distribution across ~12 buckets, not security properties.
 */
export function getClusterColor(cluster: string): string {
  let hash = 0
  for (let i = 0; i < cluster.length; i++) {
    hash = (hash + cluster.charCodeAt(i)) | 0
  }
  return CLUSTER_PALETTE[Math.abs(hash) % CLUSTER_PALETTE.length]
}
