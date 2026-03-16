import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, RefreshCw, SearchX } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MemoryCardSkeleton } from '@/components/memories/MemoryCardSkeleton'
import type { MemorySearchResult } from '@/types'

// ---------------------------------------------------------------------------
// Result card — extends MemoryCard with a relevance score badge
// ---------------------------------------------------------------------------

interface SearchResultCardProps {
  result: MemorySearchResult
  query: string
}

function shortenProjectPath(projectPath: string): string {
  if (!projectPath) return ''
  const trimmed = projectPath.replace(/\/$/, '')
  const lastSlash = trimmed.lastIndexOf('/')
  return lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1)
}

/**
 * Formats a 0-1 relevance score as a percentage string with one decimal place.
 * Returns null when score is undefined so the caller can omit the badge.
 */
function formatScore(score: number | undefined): string | null {
  if (score === undefined || score === null) return null
  return `${(score * 100).toFixed(1)}%`
}

/**
 * Returns the colour class for the relevance badge based on the score value.
 * ≥ 5% → cyan, ≥ 2% → amber, below → muted. These thresholds are based on
 * observed RRF fusion scores (typically 0.01–0.06 range).
 */
function scoreColorClass(score: number): string {
  if (score >= 0.05) return 'bg-brand-cyan-900/40 text-brand-cyan-400 border-brand-cyan-700/40'
  if (score >= 0.02) return 'bg-brand-amber-900/40 text-brand-amber-400 border-brand-amber-700/40'
  return 'bg-surface-2 text-text-muted border-border/40'
}

function SearchResultCard({ result, query }: SearchResultCardProps) {
  const navigate = useNavigate()
  const shortProject = shortenProjectPath(result.projectPath)
  const relativeTime = formatDistanceToNow(new Date(result.createdAt), { addSuffix: true })
  const scoreLabel = formatScore(result.score)

  function handleClick() {
    navigate(`/memory/${result.id}`)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigate(`/memory/${result.id}`)
    }
  }

  return (
    <Card
      className="
        cursor-pointer bg-surface border-border/60
        transition-all duration-200
        hover:border-border hover:ring-1 hover:ring-brand-cyan-500/30
        hover:translate-y-[-1px] hover:shadow-lg hover:shadow-black/30
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
      "
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Open memory: ${result.summary}`}
    >
      <CardContent className="pt-4">
        {/* Score badge — top-right inline with summary */}
        <div className="flex items-start gap-2">
          <p className="flex-1 line-clamp-3 text-sm leading-relaxed text-text-body">
            <HighlightedText text={result.summary} query={query} />
          </p>
          {scoreLabel && result.score !== undefined && (
            <span
              className={`
                shrink-0 mt-0.5 inline-flex items-center
                rounded-full border px-2 py-0.5 text-[10px] font-mono font-medium
                ${scoreColorClass(result.score)}
              `}
              title="Relevance score"
              aria-label={`Relevance: ${scoreLabel}`}
            >
              {scoreLabel}
            </span>
          )}
        </div>
      </CardContent>

      {result.tags.length > 0 && (
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {result.tags.map((tag) => (
              <Badge
                key={tag}
                className="
                  bg-brand-amber-900/60 text-brand-amber-300
                  border border-brand-amber-700/40
                  hover:bg-brand-amber-800/60
                  cursor-default
                "
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}

      <CardFooter className="justify-between gap-3 bg-transparent border-t border-border/40 px-4 py-2.5">
        {shortProject ? (
          <span
            className="truncate text-xs text-text-muted font-mono max-w-[60%]"
            title={result.projectPath}
          >
            {shortProject}
          </span>
        ) : (
          <span className="text-xs text-text-muted italic">no project</span>
        )}
        <span className="shrink-0 text-xs text-text-muted">{relativeTime}</span>
      </CardFooter>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Highlighted text — bolds terms from the query found in the text
// ---------------------------------------------------------------------------

interface HighlightedTextProps {
  text: string
  query: string
}

/**
 * Splits `text` around any token from `query` and wraps matches in <strong>.
 * Case-insensitive; only highlights whole tokens, not partial characters.
 * Falls back to rendering text as-is when the query is empty.
 */
function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query.trim()) return <>{text}</>

  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // escape regex chars

  if (tokens.length === 0) return <>{text}</>

  const pattern = new RegExp(`(${tokens.join('|')})`, 'gi')
  const parts = text.split(pattern)

  return (
    <>
      {parts.map((part, i) =>
        new RegExp(tokens.join('|'), 'i').test(part) ? (
          <strong key={i} className="text-text-heading font-semibold">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// State-specific views
// ---------------------------------------------------------------------------

function EmptyQueryPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-text-body text-sm font-medium">Start typing to search your memories</p>
      <p className="mt-1 text-text-muted text-xs">
        Use Hybrid mode for best results, or switch to Fulltext or Vector
      </p>
    </div>
  )
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <SearchX className="size-10 text-text-muted mb-3" />
      <p className="text-text-body text-sm font-medium">
        No memories match <span className="text-brand-cyan-400">"{query}"</span>
      </p>
      <p className="mt-1 text-text-muted text-xs">
        Try a different query, switch search modes, or adjust your filters
      </p>
    </div>
  )
}

function SearchError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="size-10 text-brand-rose-400 mb-3" />
      <p className="text-text-body text-sm font-medium">Search failed</p>
      <p className="mt-1 text-text-muted text-xs">
        Check that the API server is running on port 3001
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="
          mt-4 inline-flex items-center gap-2
          rounded-lg border border-border/60 bg-surface-2
          px-4 py-1.5 text-xs text-text-body
          hover:border-border hover:bg-surface-2/80
          transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        "
      >
        <RefreshCw className="size-3.5" />
        Retry
      </button>
    </div>
  )
}

function LoadingSkeletons() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 5 }, (_, i) => (
        <MemoryCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * Renders numbered page buttons. Shows at most 7 page numbers with ellipsis
 * for large sets, keeping the UI manageable without a full pagination library.
 */
function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = buildPageRange(currentPage, totalPages)

  return (
    <nav aria-label="Search results pagination" className="flex items-center justify-center gap-1 pt-6">
      <PageButton
        label="Previous"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        ‹
      </PageButton>

      {pages.map((page, i) =>
        page === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-text-muted text-sm select-none">
            …
          </span>
        ) : (
          <PageButton
            key={page}
            label={`Page ${page}`}
            onClick={() => onPageChange(page as number)}
            active={page === currentPage}
          >
            {page}
          </PageButton>
        ),
      )}

      <PageButton
        label="Next"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        ›
      </PageButton>
    </nav>
  )
}

interface PageButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}

function PageButton({ label, onClick, disabled, active, children }: PageButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`
        min-w-[32px] h-8 px-2 rounded-md text-sm
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        disabled:opacity-40 disabled:pointer-events-none
        ${
          active
            ? 'bg-brand-cyan-500/20 text-brand-cyan-400 border border-brand-cyan-500/40 font-medium'
            : 'text-text-muted hover:text-text-body hover:bg-surface-2/60'
        }
      `}
    >
      {children}
    </button>
  )
}

/**
 * Builds a compact page list with ellipsis for sets > 7 pages.
 * Always includes first, last, current, and two neighbours.
 */
function buildPageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const items: (number | '…')[] = [1]

  if (current > 3) items.push('…')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let p = start; p <= end; p++) {
    items.push(p)
  }

  if (current < total - 2) items.push('…')
  items.push(total)

  return items
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

interface SearchResultsProps {
  query: string
  results: MemorySearchResult[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  currentPage: number
  onPageChange: (page: number) => void
}

/**
 * Renders the appropriate state for a search: empty query prompt, loading
 * skeletons, no-results, error, or the paginated result grid.
 *
 * Pagination is entirely client-side: the parent fetches up to 50 results and
 * passes the full array here. This component slices the visible window.
 */
export function SearchResults({
  query,
  results,
  isLoading,
  isError,
  onRetry,
  currentPage,
  onPageChange,
}: SearchResultsProps) {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) return <EmptyQueryPrompt />
  if (isLoading) return <LoadingSkeletons />
  if (isError) return <SearchError onRetry={onRetry} />

  const allResults = results ?? []

  if (allResults.length === 0) return <NoResults query={trimmedQuery} />

  const totalPages = Math.ceil(allResults.length / PAGE_SIZE)
  const safePage = Math.min(Math.max(currentPage, 1), totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageResults = allResults.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <div>
      {/* Result count header */}
      <p className="mb-4 text-sm text-text-muted">
        <span className="font-medium text-text-body">{allResults.length}</span>{' '}
        {allResults.length === 1 ? 'result' : 'results'} for{' '}
        <span className="text-brand-cyan-400 font-medium">"{trimmedQuery}"</span>
        {totalPages > 1 && (
          <span className="ml-2 text-text-muted text-xs">
            — page {safePage} of {totalPages}
          </span>
        )}
      </p>

      {/* Results grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageResults.map((result) => (
          <SearchResultCard key={result.id} result={result} query={trimmedQuery} />
        ))}
      </div>

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  )
}
