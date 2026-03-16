import { useNavigate } from 'react-router-dom'
import { useTags } from '@/hooks/useTags'
import { Skeleton } from '@/components/ui/skeleton'
import type { TagCount } from '@/types'

// ---------------------------------------------------------------------------
// Tier system
//
// We bucket each tag into one of four tiers based on how its count compares
// to the most-frequent tag in the visible set. Using a relative scale (rather
// than absolute thresholds) keeps the cloud visually varied whether there are
// 3 tags or 300.
//
// Tier 0 (≥ 75% of max) — largest, boldest, full opacity
// Tier 1 (≥ 40% of max) — medium-large
// Tier 2 (≥ 15% of max) — medium
// Tier 3 (<  15% of max) — smallest, lightest
// ---------------------------------------------------------------------------

type Tier = 0 | 1 | 2 | 3

function computeTier(count: number, maxCount: number): Tier {
  if (maxCount === 0) return 3
  const ratio = count / maxCount
  if (ratio >= 0.75) return 0
  if (ratio >= 0.40) return 1
  if (ratio >= 0.15) return 2
  return 3
}

const TIER_CLASSES: Record<Tier, string> = {
  0: 'text-sm    font-bold   opacity-100',
  1: 'text-xs    font-semibold opacity-90',
  2: 'text-[11px] font-medium  opacity-75',
  3: 'text-[10px] font-normal  opacity-55',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SKELETON_WIDTHS = ['w-14', 'w-20', 'w-10', 'w-24', 'w-16', 'w-12', 'w-18', 'w-16']

function TagCloudSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {SKELETON_WIDTHS.map((width, i) => (
        <Skeleton key={i} className={`h-6 rounded-full ${width}`} />
      ))}
    </div>
  )
}

function TagCloudEmpty() {
  return (
    <p className="text-sm text-text-muted italic">No tags yet</p>
  )
}

interface TagPillProps {
  tagCount: TagCount
  tier: Tier
  onClick: (tag: string) => void
}

/**
 * A single clickable amber pill. Uses a <button> so keyboard activation and
 * focus management work correctly without extra ARIA scaffolding.
 */
function TagPill({ tagCount, tier, onClick }: TagPillProps) {
  const tierClasses = TIER_CLASSES[tier]

  return (
    <button
      type="button"
      onClick={() => onClick(tagCount.tag)}
      aria-label={`Filter by tag: ${tagCount.tag} (${tagCount.count})`}
      className={`
        inline-flex items-center gap-1
        rounded-full border
        px-2.5 py-1
        transition-all duration-150
        bg-brand-amber-900/50 border-brand-amber-700/40 text-brand-amber-300
        hover:bg-brand-amber-800/70 hover:border-brand-amber-600/60 hover:text-brand-amber-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber-500/60
        cursor-pointer
        ${tierClasses}
      `}
    >
      <span>{tagCount.tag}</span>
      <span className="opacity-60 font-normal">{tagCount.count}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MAX_TAGS = 25

export function TagCloud() {
  const navigate = useNavigate()
  const { data, isLoading } = useTags()

  function handleTagClick(tag: string) {
    navigate(`/search?tags=${encodeURIComponent(tag)}`)
  }

  if (isLoading) {
    return (
      <section aria-label="Top tags loading">
        <h2 className="mb-4 text-base font-medium text-text-heading">Top Tags</h2>
        <TagCloudSkeleton />
      </section>
    )
  }

  // Server returns tags sorted by count descending; we take the top N.
  const topTags = (data?.tags ?? []).slice(0, MAX_TAGS)
  const maxCount = topTags.length > 0 ? topTags[0].count : 0

  return (
    <section aria-label="Top tags">
      <h2 className="mb-4 text-base font-medium text-text-heading">Top Tags</h2>

      {topTags.length === 0 ? (
        <TagCloudEmpty />
      ) : (
        <div className="flex flex-wrap gap-2">
          {topTags.map((tagCount) => (
            <TagPill
              key={tagCount.tag}
              tagCount={tagCount}
              tier={computeTier(tagCount.count, maxCount)}
              onClick={handleTagClick}
            />
          ))}
        </div>
      )}
    </section>
  )
}
