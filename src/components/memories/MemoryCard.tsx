import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getClusterColor } from '@/lib/cluster-colors'
import type { Memory } from '@/types'

interface MemoryCardProps {
  memory: Memory
}

/**
 * Extracts the last path segment from an absolute project path.
 * "/Users/nkamau/Development/aibrain-ui" → "aibrain-ui"
 * An empty or root-only path returns the original string unchanged.
 */
function shortenProjectPath(projectPath: string): string {
  if (!projectPath) return ''
  const trimmed = projectPath.replace(/\/$/, '')
  const lastSlash = trimmed.lastIndexOf('/')
  return lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1)
}

export function MemoryCard({ memory }: MemoryCardProps) {
  const navigate = useNavigate()

  const shortProject = shortenProjectPath(memory.projectPath)

  const relativeTime = formatDistanceToNow(new Date(memory.createdAt), {
    addSuffix: true,
  })

  function handleClick() {
    navigate(`/memory/${memory.id}`)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigate(`/memory/${memory.id}`)
    }
  }

  return (
    <Card
      className={cn(
        'cursor-pointer bg-surface border-border/60',
        'transition-all duration-200',
        'hover:border-border hover:ring-1 hover:ring-brand-cyan-500/30',
        'hover:translate-y-[-1px] hover:shadow-lg hover:shadow-black/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        memory.is_stale && 'opacity-50',
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Open memory: ${memory.summary}`}
    >
      {/* Summary — clamped to 3 lines to keep cards uniform height */}
      <CardContent className="pt-4">
        <p className="line-clamp-3 text-sm leading-relaxed text-text-body">
          {memory.summary}
        </p>
      </CardContent>

      {/* Tags */}
      {memory.tags.length > 0 && (
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {memory.tags.map((tag) => (
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

      {/* Footer: project path · cluster · relative timestamp */}
      <CardFooter className="justify-between gap-3 bg-transparent border-t border-border/40 px-4 py-2.5">
        {shortProject ? (
          <span
            className="truncate text-xs text-text-muted font-mono max-w-[60%]"
            title={memory.projectPath}
          >
            {shortProject}
          </span>
        ) : (
          <span className="text-xs text-text-muted italic">no project</span>
        )}
        {memory.cluster && (
          <span className="flex shrink-0 items-center gap-1 overflow-hidden">
            <span
              className="size-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: getClusterColor(memory.cluster) }}
              aria-hidden="true"
            />
            <span className="truncate text-xs text-text-muted max-w-[120px]" title={memory.cluster}>
              {memory.cluster}
            </span>
          </span>
        )}
        <span className="shrink-0 text-xs text-text-muted">{relativeTime}</span>
      </CardFooter>
    </Card>
  )
}
