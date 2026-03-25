/**
 * Deterministic color assignment for cluster names.
 *
 * We hash the cluster string to an index into a fixed palette of
 * Tailwind-compatible CSS color values so the same cluster always renders
 * the same color across the UI, regardless of render order.
 *
 * The palette is intentionally muted to sit comfortably in the dark theme.
 */

const CLUSTER_PALETTE: string[] = [
  '#60a5fa', // blue-400
  '#34d399', // emerald-400
  '#a78bfa', // violet-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
  '#38bdf8', // sky-400
  '#4ade80', // green-400
  '#facc15', // yellow-400
  '#f87171', // red-400
  '#c084fc', // purple-400
  '#2dd4bf', // teal-400
  '#fb7185', // rose-400
]

/**
 * Returns a deterministic hex color for the given cluster name.
 * Falls back to a neutral muted color when cluster is empty.
 */
export function getClusterColor(cluster: string): string {
  if (!cluster) return '#6b7280' // gray-500

  // Simple djb2-style hash — fast and stable across JS engines
  let hash = 5381
  for (let i = 0; i < cluster.length; i++) {
    hash = (hash * 33) ^ cluster.charCodeAt(i)
  }

  // Force unsigned 32-bit to avoid negative modulo
  const index = (hash >>> 0) % CLUSTER_PALETTE.length
  return CLUSTER_PALETTE[index]
}
