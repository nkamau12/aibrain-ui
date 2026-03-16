import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Check } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MemorySearchResult } from '@/types'

// ---------------------------------------------------------------------------
// Helper functions — internal, not exported
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// HighlightedText — bolds terms from the query found in the text
// ---------------------------------------------------------------------------

export interface HighlightedTextProps {
  text: string
  query: string
}

/**
 * Splits `text` around any token from `query` and wraps matches in <strong>.
 * Case-insensitive; only highlights whole tokens, not partial characters.
 * Falls back to rendering text as-is when the query is empty.
 */
export function HighlightedText({ text, query }: HighlightedTextProps) {
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
// SearchResultCard — extends MemoryCard with a relevance score badge
// ---------------------------------------------------------------------------

export interface SearchResultCardProps {
  result: MemorySearchResult
  query: string
  /** When true, card is in selection mode — shows checkbox, clicks toggle selection */
  selectionMode?: boolean
  /** Whether this specific card is currently selected */
  isSelected?: boolean
  /** Called when selection is toggled. shiftKey indicates range-select intent */
  onToggleSelect?: (id: string, shiftKey: boolean) => void
}

export function SearchResultCard({
  result,
  query,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: SearchResultCardProps) {
  const navigate = useNavigate()
  const shortProject = shortenProjectPath(result.projectPath)
  const relativeTime = formatDistanceToNow(new Date(result.createdAt), { addSuffix: true })
  const scoreLabel = formatScore(result.score)

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (selectionMode) {
      onToggleSelect?.(result.id, event.shiftKey)
    } else {
      navigate(`/memory/${result.id}`)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (selectionMode) {
        // Keyboard-triggered selection never implies shift-range intent
        onToggleSelect?.(result.id, false)
      } else {
        navigate(`/memory/${result.id}`)
      }
    }
  }

  return (
    <Card
      className={cn(
        'relative cursor-pointer bg-surface border-border/60',
        'transition-all duration-200',
        'hover:border-border hover:ring-1 hover:ring-brand-cyan-500/30',
        'hover:translate-y-[-1px] hover:shadow-lg hover:shadow-black/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected && selectionMode && 'ring-2 ring-brand-cyan-500/40 bg-brand-cyan-950/10',
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role={selectionMode ? 'checkbox' : 'button'}
      aria-label={selectionMode ? result.summary : `Open memory: ${result.summary}`}
      aria-checked={selectionMode ? isSelected : undefined}
    >
      {selectionMode && (
        <div
          className={cn(
            'absolute top-3 left-3 z-10 size-5 rounded border flex items-center justify-center transition-colors duration-150',
            isSelected
              ? 'bg-brand-cyan-500 border-brand-cyan-500 text-white'
              : 'border-border bg-surface hover:border-text-muted',
          )}
          aria-hidden="true"
        >
          {isSelected && <Check className="size-3" />}
        </div>
      )}

      <CardContent className={cn('pt-4', selectionMode && 'pl-11')}>
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
        <CardContent className={cn('pt-0', selectionMode && 'pl-11')}>
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
