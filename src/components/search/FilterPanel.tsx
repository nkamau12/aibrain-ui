import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useTags } from '@/hooks/useTags'
import { Badge } from '@/components/ui/badge'
import type { SearchFilters } from '@/types'

interface FilterPanelProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
}

/**
 * Collapsible filter panel. On desktop (md+) it is expanded by default; on
 * mobile it starts collapsed to save vertical space.
 *
 * Filters are additive — each active filter narrows the result set further.
 * Clearing resets every dimension at once.
 */
export function FilterPanel({ filters, onFiltersChange }: FilterPanelProps) {
  // Default open on desktop, closed on mobile. We track a single boolean for
  // the toggle, but the md:block override in CSS handles the desktop default.
  const [mobileOpen, setMobileOpen] = useState(false)

  const { data: tagsData } = useTags()
  const availableTags = tagsData?.tags ?? []

  const activeFilterCount = countActiveFilters(filters)

  function setFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    onFiltersChange({ ...filters, [key]: value })
  }

  function clearFilters() {
    onFiltersChange({})
  }

  function toggleTag(tag: string) {
    const current = filters.tags ?? []
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag]
    setFilter('tags', next.length > 0 ? next : undefined)
  }

  function removeTag(tag: string) {
    const current = filters.tags ?? []
    const next = current.filter((t) => t !== tag)
    setFilter('tags', next.length > 0 ? next : undefined)
  }

  return (
    <aside className="rounded-lg border border-border/60 bg-surface overflow-hidden">
      {/* Panel header — always visible, controls mobile toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="
            flex items-center gap-2 text-sm font-medium text-text-heading
            md:cursor-default
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded
          "
          aria-expanded={mobileOpen}
          aria-controls="filter-panel-body"
        >
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center size-4 rounded-full bg-brand-cyan-500/20 text-brand-cyan-400 text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          )}
          {/* Chevron only on mobile */}
          <span className="ml-1 md:hidden text-text-muted">
            {mobileOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </span>
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="
              text-xs text-text-muted hover:text-brand-rose-400
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded
            "
          >
            Clear all
          </button>
        )}
      </div>

      {/* Panel body — hidden on mobile unless toggled; always visible on md+ */}
      <div
        id="filter-panel-body"
        className={`${mobileOpen ? 'block' : 'hidden'} lg:block`}
      >
        <div className="p-4 space-y-5">
          {/* Project path filter */}
          <FilterSection label="Project">
            <input
              type="text"
              value={filters.projectPath ?? ''}
              onChange={(e) => setFilter('projectPath', e.target.value || undefined)}
              placeholder="Filter by project path…"
              className="
                w-full h-8 rounded-md
                bg-surface-2 border border-border/60
                px-3 text-xs text-text-body
                placeholder:text-text-muted
                focus:outline-none focus:border-brand-cyan-500/50 focus:ring-1 focus:ring-brand-cyan-500/25
                transition-colors duration-150
              "
            />
          </FilterSection>

          {/* Agent name filter */}
          <FilterSection label="Agent">
            <input
              type="text"
              value={filters.agentName ?? ''}
              onChange={(e) => setFilter('agentName', e.target.value || undefined)}
              placeholder="Filter by agent name…"
              className="
                w-full h-8 rounded-md
                bg-surface-2 border border-border/60
                px-3 text-xs text-text-body
                placeholder:text-text-muted
                focus:outline-none focus:border-brand-cyan-500/50 focus:ring-1 focus:ring-brand-cyan-500/25
                transition-colors duration-150
              "
            />
          </FilterSection>

          {/* Tags multi-select */}
          <FilterSection label="Tags">
            {/* Active tag pills */}
            {(filters.tags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {filters.tags!.map((tag) => (
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

            {/* Scrollable tag picker */}
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {availableTags.map(({ tag }) => {
                  const isSelected = filters.tags?.includes(tag) ?? false
                  return (
                    <Badge
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`
                        cursor-pointer transition-all duration-150
                        ${
                          isSelected
                            ? 'bg-brand-amber-800/60 text-brand-amber-200 border-brand-amber-600/50'
                            : 'bg-brand-amber-900/40 text-brand-amber-400 border-brand-amber-700/30 opacity-70 hover:opacity-100'
                        }
                        border
                      `}
                    >
                      {tag}
                    </Badge>
                  )
                })}
              </div>
            )}
          </FilterSection>

          {/* Date range */}
          <FilterSection label="Date range">
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wide">
                  From
                </label>
                <input
                  type="date"
                  value={filters.since ? filters.since.slice(0, 10) : ''}
                  onChange={(e) =>
                    setFilter('since', e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined)
                  }
                  className="
                    w-full h-8 rounded-md
                    bg-surface-2 border border-border/60
                    px-3 text-xs text-text-body
                    focus:outline-none focus:border-brand-cyan-500/50 focus:ring-1 focus:ring-brand-cyan-500/25
                    transition-colors duration-150
                  "
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wide">
                  To
                </label>
                <input
                  type="date"
                  value={filters.until ? filters.until.slice(0, 10) : ''}
                  onChange={(e) =>
                    setFilter('until', e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined)
                  }
                  className="
                    w-full h-8 rounded-md
                    bg-surface-2 border border-border/60
                    px-3 text-xs text-text-body
                    focus:outline-none focus:border-brand-cyan-500/50 focus:ring-1 focus:ring-brand-cyan-500/25
                    transition-colors duration-150
                  "
                />
              </div>
            </div>
          </FilterSection>
        </div>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

interface FilterSectionProps {
  label: string
  children: React.ReactNode
}

function FilterSection({ label, children }: FilterSectionProps) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
        {label}
      </p>
      {children}
    </div>
  )
}

/**
 * Returns the number of active filter dimensions so we can show a badge on
 * the collapsed panel header.
 */
function countActiveFilters(filters: SearchFilters): number {
  let count = 0
  if (filters.projectPath) count++
  if (filters.agentName) count++
  if (filters.tags?.length) count++
  if (filters.since) count++
  if (filters.until) count++
  return count
}
