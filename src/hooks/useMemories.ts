import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

// ---------------------------------------------------------------------------
// Inline types (src/types/ will be created in task 1.8; these live here
// until that module is available and hooks are updated to import from it)
// ---------------------------------------------------------------------------

interface Memory {
  id: string
  /** Only present when the request was made with includeContent: true */
  content?: string
  summary: string
  tags: string[]
  agentName: string
  sessionId: string
  projectPath: string
  createdAt: string
  metadata: Record<string, unknown>
}

interface MemorySearchResult extends Memory {
  /** Relevance score returned by the hybrid search engine */
  score?: number
}

interface RecentMemoriesFilters {
  limit?: number
  projectPath?: string
  agentName?: string
  tags?: string[]
}

interface SearchMemoriesFilters {
  projectPath?: string
  agentName?: string
  tags?: string[]
  since?: string
  until?: string
}

type SearchMode = 'hybrid' | 'fulltext' | 'vector'

interface SearchMemoriesOptions {
  limit?: number
  includeContent?: boolean
  contentMaxLength?: number
}

interface RecentMemoriesResponse {
  memories: Memory[]
  total: number
}

interface SearchMemoriesResponse {
  results: MemorySearchResult[]
  totalFound: number
  searchMode: SearchMode
}

// ---------------------------------------------------------------------------
// Query key factory — centralised so invalidations stay in sync with fetches
// ---------------------------------------------------------------------------

export const memoryKeys = {
  all: ['memories'] as const,
  recent: (filters?: RecentMemoriesFilters) => ['memories', 'recent', filters ?? {}] as const,
  search: (query: string, searchMode: SearchMode, filters?: SearchMemoriesFilters, options?: SearchMemoriesOptions) =>
    ['memories', 'search', query, searchMode, filters ?? {}, options ?? {}] as const,
  detail: (id: string) => ['memories', id] as const,
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetches recent memories, optionally filtered by projectPath, agentName,
 * tags, and limit. Re-fetches automatically when filters change.
 */
export function useRecentMemories(filters?: RecentMemoriesFilters) {
  return useQuery<RecentMemoriesResponse>({
    queryKey: memoryKeys.recent(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters?.limit != null) params.set('limit', String(filters.limit))
      if (filters?.projectPath) params.set('projectPath', filters.projectPath)
      if (filters?.agentName) params.set('agentName', filters.agentName)
      if (filters?.tags?.length) {
        filters.tags.forEach((tag) => params.append('tags', tag))
      }
      const qs = params.toString()
      return apiFetch<RecentMemoriesResponse>(`/api/memories/recent${qs ? `?${qs}` : ''}`)
    },
  })
}

/**
 * Full-text / semantic / hybrid search across memories.
 *
 * The query is deliberately disabled when `query` is an empty string —
 * callers should fall back to `useRecentMemories` in that case.
 */
export function useSearchMemories(
  query: string,
  searchMode: SearchMode = 'hybrid',
  filters?: SearchMemoriesFilters,
  options?: SearchMemoriesOptions,
) {
  return useQuery<SearchMemoriesResponse>({
    queryKey: memoryKeys.search(query, searchMode, filters, options),
    queryFn: () =>
      apiFetch<SearchMemoriesResponse>('/api/memories/search', {
        method: 'POST',
        body: JSON.stringify({ query, searchMode, ...filters, ...options }),
      }),
    // Only fire when there is a non-empty search term
    enabled: query.trim().length > 0,
  })
}

/**
 * Fetches the full content of a single memory by ID.
 * Disabled when `id` is falsy (e.g. while navigating to a detail page).
 */
export function useMemory(id: string | undefined) {
  return useQuery<Memory>({
    queryKey: memoryKeys.detail(id ?? ''),
    queryFn: () => apiFetch<Memory>(`/api/memories/${id}`),
    enabled: Boolean(id),
  })
}

/**
 * Deletes a memory by ID and invalidates both the deleted item's cache entry
 * and the recent-memories list so any visible lists refresh automatically.
 */
export function useDeleteMemory() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/memories/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      // Remove the exact detail entry immediately
      queryClient.removeQueries({ queryKey: memoryKeys.detail(id) })
      // Invalidate all recent-memory lists so they re-fetch and drop the deleted item
      queryClient.invalidateQueries({ queryKey: ['memories', 'recent'] })
    },
  })
}
