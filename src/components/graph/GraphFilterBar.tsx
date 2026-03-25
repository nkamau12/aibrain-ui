import { useState } from 'react'
import { Network, Table2, X, SlidersHorizontal } from 'lucide-react'
import { useStats } from '@/hooks/useStats'
import { useTags } from '@/hooks/useTags'
import type { GraphFilters } from '@/hooks/useGraphFilters'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphFilterBarProps {
  filters: GraphFilters
  onFilterChange: (key: string, value: unknown) => void
  onReset: () => void
  nodeCount: number
  linkCount: number
  truncated: boolean
  totalMemories: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if any data-filter field (cluster, projectPath, tags,
 * includeStale) carries an active value. View/display modes are intentionally
 * excluded because they are preferences, not filters.
 */
function hasActiveFilters(filters: GraphFilters): boolean {
  return !!(
    filters.cluster ||
    filters.projectPath ||
    (filters.tags?.length ?? 0) > 0 ||
    filters.includeStale
  )
}

// ---------------------------------------------------------------------------
// Shared control className
// ---------------------------------------------------------------------------

const SELECT_CLS = `
  h-8 rounded-md
  bg-surface-2 border border-border/60
  px-2 text-xs text-text-body
  hover:border-border
  focus-visible:outline-none focus-visible:border-brand-cyan-500/60 focus-visible:ring-1 focus-visible:ring-brand-cyan-500/30
  transition-colors duration-150
  [color-scheme:dark]
`.trim()

// ---------------------------------------------------------------------------
// Mobile filter sheet
// ---------------------------------------------------------------------------

interface MobileFiltersProps extends GraphFilterBarProps {
  availableClusters: Array<{ name: string; count: number }>
  availableProjects: Array<{ path: string; count: number }>
  availableTags: Array<{ tag: string; count?: number }>
  onClose: () => void
}

/**
 * Full-width dropdown that renders below the filter bar on small screens.
 * Mirrors the FilterPanel layout, adapted for inline use.
 */
function MobileFiltersSheet({
  filters,
  onFilterChange,
  onReset,
  availableClusters,
  availableProjects,
  availableTags,
  onClose,
}: MobileFiltersProps) {
  return (
    <div className="absolute top-full left-0 right-0 z-20 border-b border-border bg-surface/95 backdrop-blur-sm shadow-lg p-4 space-y-3">
      {/* Cluster */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Cluster</p>
        <select
          value={filters.cluster ?? ''}
          onChange={(e) => onFilterChange('cluster', e.target.value || undefined)}
          className={`${SELECT_CLS} w-full`}
        >
          <option value="">All clusters</option>
          {availableClusters.map(({ name, count }) => (
            <option key={name} value={name}>{name} ({count})</option>
          ))}
        </select>
      </div>

      {/* Project */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Project</p>
        <select
          value={filters.projectPath ?? ''}
          onChange={(e) => onFilterChange('projectPath', e.target.value || undefined)}
          className={`${SELECT_CLS} w-full`}
        >
          <option value="">All projects</option>
          {availableProjects.map(({ path, count }) => {
            const label = path.replace(/\/$/, '').split('/').pop() || path
            return (
              <option key={path} value={path}>{label} ({count})</option>
            )
          })}
        </select>
      </div>

      {/* Tags */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Tags</p>
        <TagsInput
          value={filters.tags ?? []}
          availableTags={availableTags.map(({ tag }) => tag)}
          onChange={(tags) => onFilterChange('tags', tags.length > 0 ? tags : undefined)}
        />
      </div>

      {/* Stale + close row */}
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.includeStale ?? false}
            onChange={(e) => onFilterChange('includeStale', e.target.checked || undefined)}
            className="size-3.5 rounded border border-border/60 bg-surface-2 accent-brand-cyan-500 cursor-pointer"
          />
          Show stale
        </label>
        <div className="flex items-center gap-3">
          {hasActiveFilters(filters) && (
            <button
              type="button"
              onClick={() => { onReset(); onClose() }}
              className="text-xs text-brand-rose-400 hover:text-brand-rose-300 transition-colors"
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-text-muted hover:text-text-body transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TagsInput — compact comma-separated tag entry with a remove-badge per tag
// ---------------------------------------------------------------------------

interface TagsInputProps {
  value: string[]
  availableTags: string[]
  onChange: (tags: string[]) => void
}

function TagsInput({ value, availableTags, onChange }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('')

  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInputValue('')
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  // Unselected tags available for quick-add
  const suggestions = availableTags.filter((t) => !value.includes(t))

  return (
    <div className="space-y-1.5">
      {/* Active tag pills */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <span
              key={tag}
              className="
                inline-flex items-center gap-1
                bg-brand-cyan-900/40 border border-brand-cyan-700/40 text-brand-cyan-300
                rounded-full px-2 py-0.5 text-[11px] font-medium
              "
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="text-brand-cyan-400/70 hover:text-brand-cyan-300 transition-colors"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Text input */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? 'Type a tag, press Enter…' : 'Add another…'}
        className={`${SELECT_CLS} w-full px-2`}
        list="graph-tags-datalist"
      />
      {/* Native datalist for browser autocomplete — no extra dependency needed */}
      <datalist id="graph-tags-datalist">
        {suggestions.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Segmented control — shared by view-mode and display-mode toggles
// ---------------------------------------------------------------------------

interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="
        inline-flex items-center
        h-8 rounded-md
        bg-surface-2 border border-border/60
        overflow-hidden
      "
    >
      {options.map((opt, idx) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`
            flex items-center gap-1.5 px-2.5 h-full text-xs font-medium
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-cyan-500/50
            ${idx > 0 ? 'border-l border-border/60' : ''}
            ${
              value === opt.value
                ? 'bg-brand-cyan-500/15 text-brand-cyan-300'
                : 'text-text-muted hover:text-text-body hover:bg-surface'
            }
          `}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GraphFilterBar
// ---------------------------------------------------------------------------

/**
 * Horizontal filter bar for the Brain Graph page.
 *
 * On desktop (md+) all controls are shown inline in a single h-12 stripe.
 * On mobile a "Filters" button opens a full-width sheet below the bar so the
 * controls remain accessible without overflowing the viewport.
 *
 * The component is deliberately thin — it owns no state beyond the mobile
 * sheet open/close toggle. All filter state lives in the URL via useGraphFilters.
 */
export function GraphFilterBar({
  filters,
  onFilterChange,
  onReset,
  nodeCount,
  linkCount,
  truncated,
  totalMemories,
}: GraphFilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const { data: statsData } = useStats()
  const availableClusters = statsData?.clusters ?? []
  const availableProjects = statsData?.projects ?? []

  const { data: tagsData } = useTags()
  const availableTags = tagsData?.tags ?? []

  const isFiltered = hasActiveFilters(filters)
  const viewMode = filters.viewMode ?? '2d'
  const displayMode = filters.displayMode ?? 'graph'

  return (
    <div className="relative shrink-0">
      {/* ── Main bar ── */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-border bg-surface/80 backdrop-blur-sm overflow-x-auto">

        {/* ── Mobile: Filters toggle ── */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="
            md:hidden flex items-center gap-1.5 shrink-0
            h-8 px-2.5 rounded-md
            bg-surface-2 border border-border/60
            text-xs text-text-muted hover:text-text-body hover:border-border
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-cyan-500/50
          "
          aria-expanded={mobileOpen}
          aria-controls="graph-filter-sheet"
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {isFiltered && (
            <span className="inline-flex items-center justify-center size-4 rounded-full bg-brand-cyan-500/20 text-brand-cyan-400 text-[10px] font-semibold">
              {[filters.cluster, filters.projectPath, filters.includeStale ? '1' : null]
                .filter(Boolean).length + (filters.tags?.length ?? 0)}
            </span>
          )}
        </button>

        {/* ── Desktop inline controls ── */}
        <div className="hidden md:flex items-center gap-3 flex-1 min-w-0">

          {/* Cluster select */}
          <select
            value={filters.cluster ?? ''}
            onChange={(e) => onFilterChange('cluster', e.target.value || undefined)}
            className={SELECT_CLS}
            aria-label="Filter by cluster"
          >
            <option value="">All clusters</option>
            {availableClusters.map(({ name, count }) => (
              <option key={name} value={name}>{name} ({count})</option>
            ))}
          </select>

          {/* Project select */}
          <select
            value={filters.projectPath ?? ''}
            onChange={(e) => onFilterChange('projectPath', e.target.value || undefined)}
            className={SELECT_CLS}
            aria-label="Filter by project"
          >
            <option value="">All projects</option>
            {availableProjects.map(({ path, count }) => {
              const label = path.replace(/\/$/, '').split('/').pop() || path
              return (
                <option key={path} value={path}>{label} ({count})</option>
              )
            })}
          </select>

          {/* Tags input */}
          <div className="min-w-[140px] max-w-[220px]">
            <TagsInput
              value={filters.tags ?? []}
              availableTags={availableTags.map(({ tag }) => tag)}
              onChange={(tags) => onFilterChange('tags', tags.length > 0 ? tags : undefined)}
            />
          </div>

          {/* Show stale checkbox */}
          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none shrink-0 whitespace-nowrap">
            <input
              type="checkbox"
              checked={filters.includeStale ?? false}
              onChange={(e) => onFilterChange('includeStale', e.target.checked || undefined)}
              className="size-3.5 rounded border border-border/60 bg-surface-2 accent-brand-cyan-500 cursor-pointer"
            />
            Show stale
          </label>

          {/* Clear filters — only when something is active */}
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="
                flex items-center gap-1 shrink-0
                text-xs text-text-muted hover:text-brand-rose-400
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded
              "
            >
              <X className="size-3" />
              Clear filters
            </button>
          )}
        </div>

        {/* ── Right-aligned controls (always visible) ── */}
        <div className="flex items-center gap-3 ml-auto shrink-0">

          {/* Stats text */}
          <span className="hidden sm:block text-xs text-text-muted whitespace-nowrap">
            {nodeCount} node{nodeCount !== 1 ? 's' : ''} · {linkCount} link{linkCount !== 1 ? 's' : ''}
          </span>

          {/* Truncation warning */}
          {truncated && (
            <span className="text-xs text-brand-amber-400 whitespace-nowrap">
              Showing {nodeCount} of {totalMemories}
            </span>
          )}

          {/* View mode: 2D / 3D */}
          <SegmentedControl
            ariaLabel="View mode"
            value={viewMode}
            onChange={(v) => onFilterChange('viewMode', v)}
            options={[
              { value: '2d', label: '2D' },
              { value: '3d', label: '3D' },
            ]}
          />

          {/* Display mode: Graph / Table */}
          <SegmentedControl
            ariaLabel="Display mode"
            value={displayMode}
            onChange={(v) => onFilterChange('displayMode', v)}
            options={[
              { value: 'graph', label: 'Graph', icon: <Network className="size-3" aria-hidden /> },
              { value: 'table', label: 'Table', icon: <Table2 className="size-3" aria-hidden /> },
            ]}
          />
        </div>
      </div>

      {/* ── Mobile filter sheet ── */}
      {mobileOpen && (
        <div id="graph-filter-sheet">
          <MobileFiltersSheet
            filters={filters}
            onFilterChange={onFilterChange}
            onReset={onReset}
            onClose={() => setMobileOpen(false)}
            nodeCount={nodeCount}
            linkCount={linkCount}
            truncated={truncated}
            totalMemories={totalMemories}
            availableClusters={availableClusters}
            availableProjects={availableProjects}
            availableTags={availableTags}
          />
        </div>
      )}
    </div>
  )
}
