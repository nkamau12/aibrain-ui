import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useSearchMemories, useRecentMemories } from '@/hooks/useMemories'
import { useDeleteMemories } from '@/hooks/useDeleteMemories'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchModeToggle } from '@/components/search/SearchModeToggle'
import { FilterPanel } from '@/components/search/FilterPanel'
import { SearchResults } from '@/components/search/SearchResults'
import { BatchActionBar } from '@/components/search/BatchActionBar'
import { BatchDeleteConfirmDialog } from '@/components/search/BatchDeleteConfirmDialog'
import type { SearchFilters } from '@/types'

type SearchMode = 'hybrid' | 'fulltext' | 'vector'

// ---------------------------------------------------------------------------
// URL ↔ state serialisation helpers
//
// We keep search state in the URL so searches are shareable and the back button
// works as expected. All URL manipulation goes through these helpers so the
// serialisation format stays consistent and is easy to change.
// ---------------------------------------------------------------------------

function readSearchMode(raw: string | null): SearchMode {
  if (raw === 'fulltext' || raw === 'vector' || raw === 'hybrid') return raw
  return 'hybrid'
}

function filtersFromParams(params: URLSearchParams): SearchFilters {
  const filters: SearchFilters = {}

  const project = params.get('project')
  if (project) filters.projectPath = project

  const agent = params.get('agent')
  if (agent) filters.agentName = agent

  const cluster = params.get('cluster')
  if (cluster) filters.cluster = cluster

  const tags = params.getAll('tags')
  if (tags.length > 0) filters.tags = tags

  const since = params.get('since')
  if (since) filters.since = since

  const until = params.get('until')
  if (until) filters.until = until

  // 'stale=1' in the URL means show stale memories. We use '1' rather than
  // 'true' to keep URLs short when shared.
  if (params.get('stale') === '1') filters.includeStale = true

  return filters
}

function filtersToParams(filters: SearchFilters, params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)

  // Always replace — clear previous values before writing new ones
  next.delete('project')
  next.delete('agent')
  next.delete('cluster')
  next.delete('tags')
  next.delete('since')
  next.delete('until')
  next.delete('stale')

  if (filters.projectPath) next.set('project', filters.projectPath)
  if (filters.agentName) next.set('agent', filters.agentName)
  if (filters.cluster) next.set('cluster', filters.cluster)
  if (filters.tags?.length) {
    filters.tags.forEach((t) => next.append('tags', t))
  }
  if (filters.since) next.set('since', filters.since)
  if (filters.until) next.set('until', filters.until)
  if (filters.includeStale) next.set('stale', '1')

  return next
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const SEARCH_FETCH_LIMIT = 50
const PAGE_SIZE = 10

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    document.title = 'Search — aiBrain'
  }, [])

  // Derive initial state from URL on first render
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [mode, setMode] = useState<SearchMode>(() => readSearchMode(searchParams.get('mode')))
  const [filters, setFilters] = useState<SearchFilters>(() => filtersFromParams(searchParams))
  const [page, setPage] = useState(1)

  // -------------------------------------------------------------------------
  // Selection state
  // -------------------------------------------------------------------------

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const {
    state: deleteState,
    deleteMemories,
    retryFailed,
    reset: resetDeleteState,
  } = useDeleteMemories()

  // -------------------------------------------------------------------------
  // URL sync — write state → URL whenever it changes.
  // We use a replace (not push) so flipping modes doesn't pollute history.
  // -------------------------------------------------------------------------

  useEffect(() => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (mode !== 'hybrid') next.set('mode', mode)
    const withFilters = filtersToParams(filters, next)
    setSearchParams(withFilters, { replace: true })
  }, [query, mode, filters]) // intentionally exclude setSearchParams

  // -------------------------------------------------------------------------
  // Reset to page 1 whenever query or filters change
  // -------------------------------------------------------------------------

  useEffect(() => {
    setPage(1)
  }, [query, mode, filters])

  // -------------------------------------------------------------------------
  // Clear selection whenever query, filters, mode, or page change so stale
  // IDs from a previous result set cannot be silently deleted.
  // -------------------------------------------------------------------------

  useEffect(() => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }, [query, mode, filters, page])

  // -------------------------------------------------------------------------
  // Escape key exits selection mode
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!selectionMode) return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept Escape when the user is typing in an input or textarea
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setSelectionMode(false)
        setSelectedIds(new Set())
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectionMode])

  // -------------------------------------------------------------------------
  // Data fetching
  //
  // When the user has typed a query → use search (hybrid/fulltext/vector).
  // When the query is empty but filters are set (e.g. navigated from Tags
  // page with ?tags=foo) → fall back to useRecentMemories with those filters.
  // -------------------------------------------------------------------------

  const hasQuery = query.trim().length > 0
  const hasFilters = Boolean(
    filters.projectPath ||
    filters.agentName ||
    filters.cluster ||
    filters.tags?.length ||
    filters.since ||
    filters.until ||
    filters.includeStale,
  )

  // Destructure so we can pass cluster/includeStale to the right layer.
  // `includeStale` lives in SearchFilters (for the filter panel) but the
  // search endpoint expects it as a top-level SearchOptions field.
  const { includeStale, ...filterPredicates } = filters

  const searchResult = useSearchMemories(
    query,
    mode,
    filterPredicates,
    { limit: SEARCH_FETCH_LIMIT },
    includeStale ? { include_stale: true } : undefined,
  )

  const browseResult = useRecentMemories(
    !hasQuery && hasFilters
      ? { limit: 100, ...filters }
      : undefined,
  )

  // Pick the active result set based on whether we have a query
  const activeResult = hasQuery ? searchResult : browseResult
  const { isLoading, isError } = activeResult
  const refetch = activeResult.refetch

  // Normalise the two response shapes into a single results array
  const data = hasQuery
    ? searchResult.data
    : browseResult.data
      ? { results: browseResult.data.memories.map((m) => ({ ...m, score: undefined })) }
      : undefined
  const showBrowseMode = !hasQuery && hasFilters

  // -------------------------------------------------------------------------
  // Derived — compute the current page result IDs so selection handlers
  // can do shift-range selection against the visible result order.
  // -------------------------------------------------------------------------

  const allResults = data?.results ?? []
  const totalPages = allResults.length > 0 ? Math.ceil(allResults.length / PAGE_SIZE) : 1
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageResults = allResults.slice(pageStart, pageStart + PAGE_SIZE)

  // Build the preview list for the delete confirmation dialog. We memoize so
  // the summaryById Map inside the dialog doesn't rebuild on every keystroke.
  const selectedMemoryPreviews = useMemo(
    () =>
      allResults
        .filter((r) => selectedIds.has(r.id))
        .map((r) => ({ id: r.id, summary: r.summary })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds, allResults],
  )

  // -------------------------------------------------------------------------
  // Watch deleteState transitions and fire toasts / clean up
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (deleteState.status === 'done') {
      const count = deleteState.deletedIds.length
      toast.success(`Deleted ${count} ${count === 1 ? 'memory' : 'memories'}`)
      setShowDeleteDialog(false)
      setSelectionMode(false)
      setSelectedIds(new Set())
      setLastSelectedId(null)
      setPage(1)
      resetDeleteState()
    }
    // No toast for the error state — ErrorView in the dialog already shows
    // failure details with a Retry button, so a toast would be redundant.
  }, [deleteState.status]) // intentionally not exhaustive — we only care about status changes

  // -------------------------------------------------------------------------
  // Handlers — search state
  // -------------------------------------------------------------------------

  const handleQueryChange = useCallback((nextQuery: string) => {
    setQuery(nextQuery)
  }, [])

  const handleModeChange = useCallback((nextMode: SearchMode) => {
    setMode(nextMode)
  }, [])

  const handleFiltersChange = useCallback((nextFilters: SearchFilters) => {
    setFilters(nextFilters)
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
    // Scroll results back into view smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // -------------------------------------------------------------------------
  // Handlers — selection
  // -------------------------------------------------------------------------

  const handleToggleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)

        if (shiftKey && lastSelectedId) {
          // Compute the range in the current page result order and toggle all
          // IDs in that range to the same state as the anchor's final state.
          const ids = pageResults.map((r) => r.id)
          const anchorIdx = ids.indexOf(lastSelectedId)
          const targetIdx = ids.indexOf(id)

          if (anchorIdx !== -1 && targetIdx !== -1) {
            const [from, to] = anchorIdx < targetIdx
              ? [anchorIdx, targetIdx]
              : [targetIdx, anchorIdx]
            // Determine the desired toggle direction from the target's current state
            const shouldSelect = !prev.has(id)
            for (let i = from; i <= to; i++) {
              if (shouldSelect) {
                next.add(ids[i])
              } else {
                next.delete(ids[i])
              }
            }
          } else {
            // Anchor not visible on this page — fall back to single toggle
            if (next.has(id)) next.delete(id)
            else next.add(id)
          }
        } else {
          if (next.has(id)) next.delete(id)
          else next.add(id)
        }

        return next
      })

      setLastSelectedId(id)
    },
    [lastSelectedId, pageResults],
  )

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      pageResults.forEach((r) => next.add(r.id))
      return next
    })
  }, [pageResults])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleEnterSelectionMode = useCallback(() => {
    setSelectionMode(true)
  }, [])

  const handleExitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }, [])

  // -------------------------------------------------------------------------
  // Handlers — batch delete flow
  // -------------------------------------------------------------------------

  const handleDeleteSelected = useCallback(() => {
    setShowDeleteDialog(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    await deleteMemories([...selectedIds])
  }, [deleteMemories, selectedIds])

  // Close the dialog and reset delete state without touching selection mode.
  // Cancelling the dialog means the user changed their mind — they should stay
  // in selection mode so they can adjust their selection or try again.
  // Selection mode exits only on successful deletion (done useEffect above) or
  // when the user explicitly clicks Cancel in the BatchActionBar.
  const handleDialogClose = useCallback(() => {
    setShowDeleteDialog(false)
    resetDeleteState()
  }, [resetDeleteState])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-text-heading">Search</h1>
        <p className="mt-1 text-sm text-text-muted">
          Search across all your memories using keyword, semantic, or hybrid retrieval
        </p>
      </div>

      {/* Search bar — full width */}
      <SearchBar
        initialValue={query}
        onQueryChange={handleQueryChange}
      />

      {/* Mode toggle — sits below the search bar */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-muted shrink-0">Mode:</span>
        <SearchModeToggle value={mode} onChange={handleModeChange} />
      </div>

      {/*
       * Two-column layout on desktop:
       *   left  = FilterPanel (fixed-width sidebar)
       *   right = SearchResults (takes remaining space)
       *
       * On mobile both stack vertically, filter panel collapses.
       */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
        {/* Sidebar filters */}
        <div className="lg:self-start lg:sticky lg:top-6">
          <FilterPanel filters={filters} onFiltersChange={handleFiltersChange} />
        </div>

        {/* Main results area */}
        <main>
          <SearchResults
            query={query}
            results={data?.results}
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            currentPage={page}
            onPageChange={handlePageChange}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onEnterSelectionMode={handleEnterSelectionMode}
            browseMode={showBrowseMode}
          />
        </main>
      </div>

      {/* Fixed bottom action bar — shown only in selection mode */}
      {selectionMode && (
        <BatchActionBar
          selectedCount={selectedIds.size}
          pageCount={pageResults.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onDelete={handleDeleteSelected}
          onCancel={handleExitSelectionMode}
        />
      )}

      {/* Batch delete confirmation dialog */}
      <BatchDeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedMemories={selectedMemoryPreviews}
        deleteState={deleteState}
        onConfirm={handleConfirmDelete}
        onRetry={retryFailed}
        onClose={handleDialogClose}
      />
    </div>
  )
}
