import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

// ---------------------------------------------------------------------------
// Inline types (will be replaced by imports from src/types/ in task 1.8)
// ---------------------------------------------------------------------------

interface TagCount {
  tag: string
  count: number
}

interface TagsResponse {
  tags: TagCount[]
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const tagKeys = {
  all: ['tags'] as const,
  list: (projectPath?: string, agentName?: string) =>
    ['tags', 'list', projectPath ?? '', agentName ?? ''] as const,
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches all tags, optionally scoped to a specific project or agent.
 * Results are sorted by count descending (server responsibility).
 */
export function useTags(projectPath?: string, agentName?: string) {
  return useQuery<TagsResponse>({
    queryKey: tagKeys.list(projectPath, agentName),
    queryFn: () => {
      const params = new URLSearchParams()
      if (projectPath) params.set('projectPath', projectPath)
      if (agentName) params.set('agentName', agentName)
      const qs = params.toString()
      return apiFetch<TagsResponse>(`/api/tags${qs ? `?${qs}` : ''}`)
    },
  })
}
