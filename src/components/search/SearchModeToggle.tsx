type SearchMode = 'hybrid' | 'fulltext' | 'vector'

interface SearchModeToggleProps {
  value: SearchMode
  onChange: (mode: SearchMode) => void
}

const MODES: { value: SearchMode; label: string; description: string }[] = [
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Combines keyword and semantic search for best results',
  },
  {
    value: 'fulltext',
    label: 'Fulltext',
    description: 'Keyword-based BM25 search — exact term matching',
  },
  {
    value: 'vector',
    label: 'Vector',
    description: 'Semantic similarity search — finds conceptually related memories',
  },
]

/**
 * Segmented control for selecting the search retrieval strategy.
 *
 * Uses native buttons in a group container rather than a radio group, which
 * provides a cleaner visual. The active mode gets the cyan accent treatment;
 * inactive modes use the muted surface style.
 */
export function SearchModeToggle({ value, onChange }: SearchModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Search mode"
      className="inline-flex rounded-lg border border-border/60 bg-surface overflow-hidden"
    >
      {MODES.map((mode, index) => {
        const isActive = mode.value === value
        const isFirst = index === 0
        const isLast = index === MODES.length - 1

        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            onClick={() => onChange(mode.value)}
            aria-checked={isActive}
            title={mode.description}
            className={`
              relative px-4 py-1.5 text-xs font-medium
              transition-all duration-150
              focus-visible:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-cyan-500/60
              ${isFirst ? '' : 'border-l border-border/60'}
              ${isLast ? '' : ''}
              ${
                isActive
                  ? 'bg-brand-cyan-500/15 text-brand-cyan-400 border-brand-cyan-500/30'
                  : 'text-text-muted hover:text-text-body hover:bg-surface-2/60'
              }
            `}
          >
            {mode.label}
          </button>
        )
      })}
    </div>
  )
}
