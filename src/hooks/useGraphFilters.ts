import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphFilters {
  cluster?: string
  projectPath?: string
  tags?: string[]
  includeStale?: boolean
  /** ID of the node currently focused in the graph */
  focus?: string
  /** 2D or 3D render mode */
  viewMode?: '2d' | '3d'
  /** Whether to show the graph canvas or a flat table of nodes */
  displayMode?: 'graph' | 'table'
}

// ---------------------------------------------------------------------------
// URL ↔ state serialisation helpers
//
// All filter state lives in the URL so:
//   • The browser back/forward buttons work as expected
//   • Graph views are shareable via URL copy
//   • A page refresh lands back in the same state
//
// URL key mapping (kept short for readable share links):
//   cluster      → 'cluster'
//   projectPath  → 'project'
//   tags         → 'tags'  (comma-separated to keep the URL compact)
//   includeStale → 'stale' (1 = true, omitted = false)
//   focus        → 'focus'
//   viewMode     → 'mode'  (2d | 3d)
//   displayMode  → 'view'  (graph | table)
// ---------------------------------------------------------------------------

function filtersFromParams(params: URLSearchParams): GraphFilters {
  const filters: GraphFilters = {}

  const cluster = params.get('cluster')
  if (cluster) filters.cluster = cluster

  const project = params.get('project')
  if (project) filters.projectPath = project

  // Tags are stored as a single comma-separated value to avoid repeated keys
  // (e.g. ?tags=a,b,c rather than ?tags=a&tags=b&tags=c).
  const tagsRaw = params.get('tags')
  if (tagsRaw) {
    const parsed = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    if (parsed.length > 0) filters.tags = parsed
  }

  if (params.get('stale') === '1') filters.includeStale = true

  const focus = params.get('focus')
  if (focus) filters.focus = focus

  const mode = params.get('mode')
  if (mode === '2d' || mode === '3d') filters.viewMode = mode

  const view = params.get('view')
  if (view === 'graph' || view === 'table') filters.displayMode = view

  return filters
}

function filtersToParams(filters: GraphFilters): URLSearchParams {
  const next = new URLSearchParams()

  if (filters.cluster) next.set('cluster', filters.cluster)
  if (filters.projectPath) next.set('project', filters.projectPath)
  if (filters.tags?.length) next.set('tags', filters.tags.join(','))
  if (filters.includeStale) next.set('stale', '1')
  if (filters.focus) next.set('focus', filters.focus)
  // Omit defaults from the URL to keep share links clean
  if (filters.viewMode && filters.viewMode !== '2d') next.set('mode', filters.viewMode)
  if (filters.displayMode && filters.displayMode !== 'graph') next.set('view', filters.displayMode)

  return next
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseGraphFiltersReturn {
  filters: GraphFilters
  /**
   * Update a single filter key. All URL writes use `replace: true` so flipping
   * filters does not pollute the browser history stack.
   */
  setFilter: <K extends keyof GraphFilters>(key: K, value: GraphFilters[K]) => void
  /** Reset all filters to their defaults, clearing the URL params. */
  resetFilters: () => void
  /**
   * Convenience alias for `filters.focus`. Reads the currently focused node ID,
   * or undefined if nothing is focused.
   */
  focusedNodeId: string | undefined
  /**
   * Convenience alias for `setFilter('focus', id)`. Pass undefined to clear focus.
   */
  setFocusedNodeId: (id: string | undefined) => void
}

/**
 * Manages graph page filter state via URL search params.
 *
 * Mirrors the pattern used in the Search page — all state is stored in the URL
 * so views are shareable and the browser back button works correctly. All URL
 * writes use `replace: true` to avoid polluting the history stack with each
 * filter tweak.
 *
 * The hook derives its initial state from the current URL on mount; there is
 * no separate component-level state, so the URL is always the single source of
 * truth.
 */
export function useGraphFilters(): UseGraphFiltersReturn {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = filtersFromParams(searchParams)

  const setFilter = useCallback(
    <K extends keyof GraphFilters>(key: K, value: GraphFilters[K]) => {
      setSearchParams(
        (prev) => {
          const current = filtersFromParams(prev)
          const next: GraphFilters = { ...current, [key]: value }
          // Treat undefined/empty as "remove this filter"
          if (value === undefined || value === null) {
            delete next[key]
          }
          return filtersToParams(next)
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  const setFocusedNodeId = useCallback(
    (id: string | undefined) => {
      setFilter('focus', id)
    },
    [setFilter],
  )

  return {
    filters,
    setFilter,
    resetFilters,
    focusedNodeId: filters.focus,
    setFocusedNodeId,
  }
}
