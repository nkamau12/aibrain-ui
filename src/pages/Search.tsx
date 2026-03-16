import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSearchMemories } from '@/hooks/useMemories'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchModeToggle } from '@/components/search/SearchModeToggle'
import { FilterPanel } from '@/components/search/FilterPanel'
import { SearchResults } from '@/components/search/SearchResults'
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

  const tags = params.getAll('tags')
  if (tags.length > 0) filters.tags = tags

  const since = params.get('since')
  if (since) filters.since = since

  const until = params.get('until')
  if (until) filters.until = until

  return filters
}

function filtersToParams(filters: SearchFilters, params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)

  // Always replace — clear previous values before writing new ones
  next.delete('project')
  next.delete('agent')
  next.delete('tags')
  next.delete('since')
  next.delete('until')

  if (filters.projectPath) next.set('project', filters.projectPath)
  if (filters.agentName) next.set('agent', filters.agentName)
  if (filters.tags?.length) {
    filters.tags.forEach((t) => next.append('tags', t))
  }
  if (filters.since) next.set('since', filters.since)
  if (filters.until) next.set('until', filters.until)

  return next
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const SEARCH_FETCH_LIMIT = 50

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Derive initial state from URL on first render
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [mode, setMode] = useState<SearchMode>(() => readSearchMode(searchParams.get('mode')))
  const [filters, setFilters] = useState<SearchFilters>(() => filtersFromParams(searchParams))
  const [page, setPage] = useState(1)

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
  // Data fetching
  // -------------------------------------------------------------------------

  const { data, isLoading, isError, refetch } = useSearchMemories(
    query,
    mode,
    filters,
    { limit: SEARCH_FETCH_LIMIT },
  )

  // -------------------------------------------------------------------------
  // Handlers
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
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-5">
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
          />
        </main>
      </div>
    </div>
  )
}
