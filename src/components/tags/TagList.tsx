import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import { useTags } from '@/hooks/useTags'
import { Skeleton } from '@/components/ui/skeleton'
import type { TagCount } from '@/types'

// ---------------------------------------------------------------------------
// Sort state
// ---------------------------------------------------------------------------

type SortField = 'count' | 'name'
type SortDirection = 'asc' | 'desc'

interface SortState {
  field: SortField
  direction: SortDirection
}

function sortTags(tags: TagCount[], sort: SortState): TagCount[] {
  return [...tags].sort((a, b) => {
    if (sort.field === 'count') {
      return sort.direction === 'desc' ? b.count - a.count : a.count - b.count
    }
    // Alphabetical
    const cmp = a.tag.localeCompare(b.tag)
    return sort.direction === 'asc' ? cmp : -cmp
  })
}

function nextDirection(
  current: SortState,
  field: SortField,
): SortState {
  // Clicking an already-active column toggles direction.
  // Clicking a new column resets to the natural default for that field:
  //   count → desc first (most-used at top)
  //   name  → asc first  (A–Z)
  if (current.field !== field) {
    return { field, direction: field === 'count' ? 'desc' : 'asc' }
  }
  return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SKELETON_ROWS = 8

function TagListSkeleton() {
  return (
    <div className="space-y-1" aria-hidden>
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-8 rounded" />
          <Skeleton className="ml-auto h-4 w-4 rounded" />
        </div>
      ))}
    </div>
  )
}

function TagListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm text-text-muted italic">No tags found</p>
    </div>
  )
}

interface SortHeaderButtonProps {
  label: string
  field: SortField
  sort: SortState
  onClick: (field: SortField) => void
  align?: 'left' | 'right'
}

/**
 * Column header button that shows the current sort indicator for its field.
 * Using a <button> gives us keyboard activation and focus ring for free.
 */
function SortHeaderButton({ label, field, sort, onClick, align = 'left' }: SortHeaderButtonProps) {
  const isActive = sort.field === field
  const Icon = isActive
    ? sort.direction === 'asc'
      ? ArrowUp
      : ArrowDown
    : ChevronsUpDown

  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className={`
        inline-flex items-center gap-1.5
        text-xs font-medium uppercase tracking-wide
        transition-colors duration-100
        ${isActive ? 'text-brand-amber-400' : 'text-text-muted hover:text-text-body'}
        ${align === 'right' ? 'flex-row-reverse' : ''}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber-500/60
        rounded
      `}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <Icon className="h-3 w-3 shrink-0" />
    </button>
  )
}

interface TagRowProps {
  tagCount: TagCount
  onNavigate: (tag: string) => void
}

function TagRow({ tagCount, onNavigate }: TagRowProps) {
  return (
    <div
      className="
        group flex items-center gap-3 rounded-md px-3 py-2.5
        hover:bg-surface-2/50 transition-colors duration-100
      "
    >
      {/* Tag badge */}
      <button
        type="button"
        onClick={() => onNavigate(tagCount.tag)}
        aria-label={`Search memories tagged: ${tagCount.tag}`}
        className="
          inline-flex items-center gap-1.5
          rounded-full border
          px-2.5 py-0.5 text-xs font-medium
          bg-brand-amber-900/50 border-brand-amber-700/40 text-brand-amber-300
          hover:bg-brand-amber-800/70 hover:border-brand-amber-600/60 hover:text-brand-amber-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber-500/60
          transition-all duration-100 cursor-pointer shrink-0
        "
      >
        {tagCount.tag}
      </button>

      {/* Count — takes the remaining space, aligns label to left */}
      <span className="flex-1 text-sm text-text-muted tabular-nums">
        {tagCount.count}
      </span>

      {/* Search action — always visible (not just on hover) so it's obvious */}
      <button
        type="button"
        onClick={() => onNavigate(tagCount.tag)}
        aria-label={`Search memories tagged: ${tagCount.tag}`}
        className="
          flex items-center gap-1 text-xs text-text-muted
          hover:text-brand-cyan-400 transition-colors duration-100
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          rounded
        "
      >
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 hidden sm:inline">
          Search
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TagListProps {
  /** Optionally scope the tag list to a specific project */
  projectPath?: string
  /** Optionally scope the tag list to a specific agent */
  agentName?: string
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TagList({ projectPath, agentName }: TagListProps) {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useTags(projectPath, agentName)

  const [sort, setSort] = useState<SortState>({ field: 'count', direction: 'desc' })
  const [nameFilter, setNameFilter] = useState('')

  function handleSortChange(field: SortField) {
    setSort((prev) => nextDirection(prev, field))
  }

  function handleNavigate(tag: string) {
    navigate(`/search?tags=${encodeURIComponent(tag)}`)
  }

  if (isError) {
    return (
      <section aria-label="Tags list error" className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-destructive">Could not load tags. Please try again.</p>
      </section>
    )
  }

  const allTags = data?.tags ?? []

  // Apply name filter (case-insensitive substring match)
  const filteredTags = nameFilter.trim()
    ? allTags.filter((t) => t.tag.toLowerCase().includes(nameFilter.trim().toLowerCase()))
    : allTags

  const sortedTags = isLoading ? [] : sortTags(filteredTags, sort)

  return (
    <section aria-label="Tags list" className="rounded-xl border border-border bg-card">
      {/* Card header */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-heading">All Tags</h2>
          {!isLoading && (
            <p className="mt-0.5 text-xs text-text-muted">
              {allTags.length} {allTags.length === 1 ? 'tag' : 'tags'} total
            </p>
          )}
        </div>

        {/* Name filter input */}
        <input
          type="search"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Filter tags…"
          aria-label="Filter tags by name"
          className="
            w-full sm:w-48
            rounded-md border border-border/60 bg-background
            px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted
            hover:border-border
            focus-visible:outline-none focus-visible:border-brand-cyan-500/60 focus-visible:ring-1 focus-visible:ring-brand-cyan-500/30
            transition-colors duration-150
          "
        />
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 border-b border-border/50 px-3 py-2">
        <div className="flex-1">
          <SortHeaderButton label="Tag" field="name" sort={sort} onClick={handleSortChange} />
        </div>
        <div className="w-16">
          <SortHeaderButton label="Count" field="count" sort={sort} onClick={handleSortChange} />
        </div>
        {/* Spacer matching the action button width */}
        <div className="w-16" />
      </div>

      {/* Body */}
      <div className="p-1">
        {isLoading ? (
          <TagListSkeleton />
        ) : sortedTags.length === 0 ? (
          <TagListEmpty />
        ) : (
          <div role="list" aria-label="Tag entries">
            {sortedTags.map((tagCount) => (
              <TagRow
                key={tagCount.tag}
                tagCount={tagCount}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
