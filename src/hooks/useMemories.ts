import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Memory, MemorySearchResult, SearchFilters, SearchOptions } from '@/types'

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
  /** Restrict results to a specific cluster */
  cluster?: string
  /** Include superseded memories in results */
  includeStale?: boolean
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

interface RelatedMemoriesResponse {
  root: Memory | null
  nodes: Memory[]
}

// ---------------------------------------------------------------------------
// Query key factory — centralised so invalidations stay in sync with fetches
// ---------------------------------------------------------------------------

export const memoryKeys = {
  all: ['memories'] as const,
  recent: (filters?: RecentMemoriesFilters) => ['memories', 'recent', filters ?? {}] as const,
  search: (
    query: string,
    searchMode: SearchMode,
    filters?: SearchFilters,
    options?: SearchMemoriesOptions,
    searchOptions?: SearchOptions,
  ) => ['memories', 'search', query, searchMode, filters ?? {}, options ?? {}, searchOptions ?? {}] as const,
  detail: (id: string) => ['memories', id] as const,
  related: (id: string, options?: { depth?: number; relation_types?: string[]; include_stale?: boolean; include_content?: boolean }) =>
    ['memories', id, 'related', options ?? {}] as const,
  graph: (filters?: { projectPath?: string; cluster?: string; tags?: string[]; includeStale?: boolean; limit?: number }) =>
    ['graph', filters ?? {}] as const,
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetches recent memories, optionally filtered by projectPath, agentName,
 * tags, cluster, and limit. Accepts `includeStale` to surface superseded
 * memories. Re-fetches automatically when filters change.
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
        params.set('tags', filters.tags.join(','))
      }
      if (filters?.since) params.set('since', filters.since)
      if (filters?.until) params.set('until', filters.until)
      if (filters?.cluster) params.set('cluster', filters.cluster)
      if (filters?.includeStale) params.set('include_stale', 'true')
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
 * `searchOptions` controls result expansion (include_related, related_depth,
 * include_stale) — these are independent of filter predicates and affect what
 * data is returned rather than which memories match.
 *
 * The query is deliberately disabled when `query` is an empty string —
 * callers should fall back to `useRecentMemories` in that case.
 */
export function useSearchMemories(
  query: string,
  searchMode: SearchMode = 'hybrid',
  filters?: SearchFilters,
  options?: SearchMemoriesOptions,
  searchOptions?: SearchOptions,
) {
  return useQuery<SearchMemoriesResponse>({
    queryKey: memoryKeys.search(query, searchMode, filters, options, searchOptions),
    queryFn: () =>
      apiFetch<SearchMemoriesResponse>('/api/memories/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          searchMode,
          filters,
          ...options,
          // Spread search options at the top level — the server reads them as
          // sibling fields to `filters`, not nested inside it.
          ...searchOptions,
        }),
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
 * Fetches the related-memory graph rooted at a given memory ID.
 *
 * Returns `{ root, nodes }` — `root` is the starting memory, `nodes` are
 * the memories reachable within `depth` hops following `relation_types`.
 * Disabled when `memoryId` is undefined.
 */
export function useRelatedMemories(
  memoryId: string | undefined,
  options?: {
    depth?: number
    relation_types?: string[]
    include_stale?: boolean
    include_content?: boolean
  },
) {
  return useQuery<RelatedMemoriesResponse>({
    queryKey: memoryKeys.related(memoryId ?? '', options),
    queryFn: () => {
      const params = new URLSearchParams()
      if (options?.depth != null) params.set('depth', String(options.depth))
      if (options?.relation_types?.length) {
        // Server expects a comma-separated string
        params.set('relation_types', options.relation_types.join(','))
      }
      if (options?.include_stale) params.set('include_stale', 'true')
      if (options?.include_content) params.set('include_content', 'true')
      const qs = params.toString()
      return apiFetch<RelatedMemoriesResponse>(
        `/api/memories/${memoryId}/related${qs ? `?${qs}` : ''}`,
      )
    },
    enabled: Boolean(memoryId),
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
