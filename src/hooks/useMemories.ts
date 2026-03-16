import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Memory, MemorySearchResult, SearchFilters } from '@/types'

// ---------------------------------------------------------------------------
// Local types (not shared — specific to hook API shapes)
// ---------------------------------------------------------------------------

interface RecentMemoriesFilters {
  limit?: number
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
  search: (query: string, searchMode: SearchMode, filters?: SearchFilters, options?: SearchMemoriesOptions) =>
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
export function useRecentMemories(filters?: RecentMemoriesFilters | undefined) {
  return useQuery<RecentMemoriesResponse>({
    queryKey: memoryKeys.recent(filters ?? {}),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters?.limit != null) params.set('limit', String(filters.limit))
      if (filters?.projectPath) params.set('projectPath', filters.projectPath)
      if (filters?.agentName) params.set('agentName', filters.agentName)
      if (filters?.tags?.length) {
        filters.tags.forEach((tag) => params.append('tags', tag))
      }
      if (filters?.since) params.set('since', filters.since)
      if (filters?.until) params.set('until', filters.until)
      const qs = params.toString()
      return apiFetch<RecentMemoriesResponse>(`/api/memories/recent${qs ? `?${qs}` : ''}`)
    },
    // When filters is explicitly undefined (not just empty), disable the query
    enabled: filters !== undefined,
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
  filters?: SearchFilters,
  options?: SearchMemoriesOptions,
) {
  return useQuery<SearchMemoriesResponse>({
    queryKey: memoryKeys.search(query, searchMode, filters, options),
    queryFn: () =>
      apiFetch<SearchMemoriesResponse>('/api/memories/search', {
        method: 'POST',
        body: JSON.stringify({ query, searchMode, filters, ...options }),
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
 * Deletes a memory by ID with optimistic removal from cached lists.
 * On success: invalidates recent + search caches for a fresh re-fetch.
 * On error: rolls back the optimistic removal and restores previous state.
 */
export function useDeleteMemory() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, { previousRecent: unknown; previousSearch: unknown[] }>({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/memories/${id}`, { method: 'DELETE' }),

    onMutate: async (id) => {
      // Cancel in-flight queries so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['memories', 'recent'] })
      await queryClient.cancelQueries({ queryKey: ['memories', 'search'] })

      // Snapshot current cache for rollback
      const recentQueries = queryClient.getQueriesData({ queryKey: ['memories', 'recent'] })
      const searchQueries = queryClient.getQueriesData({ queryKey: ['memories', 'search'] })

      // Optimistically remove the memory from all recent-memories caches
      queryClient.setQueriesData(
        { queryKey: ['memories', 'recent'] },
        (old: { memories: Memory[]; total: number } | undefined) => {
          if (!old) return old
          return {
            ...old,
            memories: old.memories.filter((m) => m.id !== id),
            total: old.total - 1,
          }
        },
      )

      // Optimistically remove from all search result caches
      queryClient.setQueriesData(
        { queryKey: ['memories', 'search'] },
        (old: { results: Memory[]; totalFound: number; searchMode: string } | undefined) => {
          if (!old) return old
          return {
            ...old,
            results: old.results.filter((m) => m.id !== id),
            totalFound: old.totalFound - 1,
          }
        },
      )

      return { previousRecent: recentQueries, previousSearch: searchQueries }
    },

    onError: (_error, _id, context) => {
      // Rollback: restore all cached queries from snapshots
      if (context?.previousRecent) {
        for (const [key, data] of context.previousRecent as [unknown[], unknown][]) {
          queryClient.setQueryData(key, data)
        }
      }
      if (context?.previousSearch) {
        for (const [key, data] of context.previousSearch as [unknown[], unknown][]) {
          queryClient.setQueryData(key, data)
        }
      }
    },

    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: memoryKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ['memories', 'recent'] })
      queryClient.invalidateQueries({ queryKey: ['memories', 'search'] })
    },
  })
}
