import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { GraphData } from '@/types'
import { memoryKeys } from '@/hooks/useMemories'

interface GraphFilters {
  projectPath?: string
  cluster?: string
  tags?: string[]
  includeStale?: boolean
  limit?: number
}

/**
 * Fetches the full memory graph from GET /api/graph.
 *
 * Graph data is expensive to compute — staleTime is set to 30 seconds so
 * React Query won't re-fetch on every component mount. Use
 * `queryClient.invalidateQueries({ queryKey: memoryKeys.graph() })` to force
 * a refresh when underlying data changes (e.g. after a memory is deleted).
 *
 * When `truncated` is true in the response, the graph has been server-side
 * capped; surface a warning in the UI via `data.totalMemories` vs
 * `data.nodes.length`.
 */
export function useGraphData(filters?: GraphFilters) {
  return useQuery<GraphData>({
    queryKey: memoryKeys.graph(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters?.projectPath) params.set('projectPath', filters.projectPath)
      if (filters?.cluster) params.set('cluster', filters.cluster)
      if (filters?.tags?.length) {
        filters.tags.forEach((tag) => params.append('tags', tag))
      }
      if (filters?.includeStale) params.set('include_stale', 'true')
      if (filters?.limit != null) params.set('limit', String(filters.limit))
      const qs = params.toString()
      return apiFetch<GraphData>(`/api/graph${qs ? `?${qs}` : ''}`)
    },
    // Graph queries are expensive — avoid redundant re-fetches on focus/mount
    staleTime: 30_000,
  })
}
