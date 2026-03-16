import { MemoryCard } from './MemoryCard'
import { MemoryCardSkeleton } from './MemoryCardSkeleton'
import type { Memory } from '@/types'

interface MemoryListLoadingProps {
  isLoading: true
  /** Number of skeleton cards to display while loading (default: 6) */
  skeletonCount?: number
  memories?: never
}

interface MemoryListLoadedProps {
  isLoading?: false
  memories: Memory[]
  skeletonCount?: never
}

type MemoryListProps = MemoryListLoadingProps | MemoryListLoadedProps

const GRID_CLASSES = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'

/**
 * Renders a responsive grid of MemoryCard components.
 *
 * Pass `isLoading={true}` to render skeleton cards in place of real data
 * (prevents layout shift when data arrives). Pass `memories` array with
 * `isLoading` omitted or false to render real cards.
 */
export function MemoryList(props: MemoryListProps) {
  if (props.isLoading) {
    const count = props.skeletonCount ?? 6
    return (
      <div className={GRID_CLASSES}>
        {Array.from({ length: count }, (_, i) => (
          <MemoryCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  const { memories } = props

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-text-muted text-sm">No memories yet</p>
        <p className="text-text-muted/60 text-xs mt-1">
          Memories saved via aibrain-mcp will appear here
        </p>
      </div>
    )
  }

  return (
    <div className={GRID_CLASSES}>
      {memories.map((memory) => (
        <MemoryCard key={memory.id} memory={memory} />
      ))}
    </div>
  )
}
