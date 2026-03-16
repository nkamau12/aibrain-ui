import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { StatsResponse, TimelinePoint } from '@/types'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const statsKeys = {
  all: ['stats'] as const,
  overview: () => ['stats', 'overview'] as const,
  timeline: (days?: number) => ['stats', 'timeline', days ?? 30] as const,
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetches aggregated stats: total memory count, this-week count, top project,
 * top agent, and top tags. Used by the Dashboard summary panel.
 */
export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: statsKeys.overview(),
    queryFn: () => apiFetch<StatsResponse>('/api/stats'),
  })
}

/**
 * Fetches a day-by-day memory creation timeline for the last `days` days.
 * Zero-count days are included so charts render a continuous x-axis.
 *
 * @param days - Number of days to look back (defaults to 30 on the server).
 */
export function useTimeline(days?: number) {
  return useQuery<TimelinePoint[]>({
    queryKey: statsKeys.timeline(days),
    queryFn: () => {
      const params = days != null ? `?days=${days}` : ''
      return apiFetch<TimelinePoint[]>(`/api/stats/timeline${params}`)
    },
  })
}
