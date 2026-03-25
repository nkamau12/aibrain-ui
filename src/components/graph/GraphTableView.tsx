import { useState, useMemo, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getClusterColor } from '@/lib/cluster-colors'
import type { GraphData, GraphNode } from '@/types/memory'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphTableViewProps {
  data: GraphData
  onNodeClick: (nodeId: string) => void
  focusedNodeId?: string
}

type SortColumn = 'summary' | 'cluster' | 'tags' | 'connectionCount' | 'createdAt'
type SortDirection = 'asc' | 'desc'

interface SortState {
  column: SortColumn
  direction: SortDirection
}

// ---------------------------------------------------------------------------
// Helpers — internal, not exported
// ---------------------------------------------------------------------------

/** Truncate a string to at most `max` characters, appending "…" when cut. */
function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

/**
 * Compare two GraphNodes by the given column for sort purposes.
 * String comparisons are case-insensitive. Undefined/null sorts last.
 */
function compareNodes(a: GraphNode, b: GraphNode, column: SortColumn): number {
  switch (column) {
    case 'summary':
      return a.summary.toLowerCase().localeCompare(b.summary.toLowerCase())
    case 'cluster': {
      const ca = (a.cluster ?? '').toLowerCase()
      const cb = (b.cluster ?? '').toLowerCase()
      if (!ca && !cb) return 0
      if (!ca) return 1  // unclustered sorts last
      if (!cb) return -1
      return ca.localeCompare(cb)
    }
    case 'tags': {
      const ta = (a.tags ?? []).join(',').toLowerCase()
      const tb = (b.tags ?? []).join(',').toLowerCase()
      return ta.localeCompare(tb)
    }
    case 'connectionCount':
      return a.connectionCount - b.connectionCount
    case 'createdAt':
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  }
}

function sortNodes(nodes: GraphNode[], { column, direction }: SortState): GraphNode[] {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...nodes].sort((a, b) => compareNodes(a, b, column) * multiplier)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SortableHeaderProps {
  label: string
  column: SortColumn
  sort: SortState
  onSort: (column: SortColumn) => void
  className?: string
}

function SortableHeader({ label, column, sort, onSort, className }: SortableHeaderProps) {
  const isActive = sort.column === column
  const ariaSortValue = isActive
    ? (sort.direction === 'asc' ? 'ascending' : 'descending')
    : 'none'

  return (
    <th
      scope="col"
      aria-sort={ariaSortValue}
      className={cn('px-3 py-2.5 text-left font-medium text-text-muted text-xs uppercase tracking-wider', className)}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors duration-150',
          'hover:text-text-body focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm',
          isActive && 'text-brand-cyan-400',
        )}
        aria-label={`Sort by ${label}${isActive ? `, currently ${ariaSortValue}` : ''}`}
      >
        {label}
        {isActive ? (
          sort.direction === 'asc'
            ? <ArrowUp className="w-3 h-3" aria-hidden />
            : <ArrowDown className="w-3 h-3" aria-hidden />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  )
}

// ---------------------------------------------------------------------------
// GraphTableView
// ---------------------------------------------------------------------------

/**
 * An accessible HTML table rendering of the memory relationship graph.
 *
 * Intended as a keyboard- and screen-reader-friendly fallback when the force
 * graph canvas is unavailable or when the user explicitly chooses the table
 * display mode. All sorting is client-side; the component is stateless w.r.t.
 * external data and receives the full GraphData payload.
 */
export function GraphTableView({ data, onNodeClick, focusedNodeId }: GraphTableViewProps) {
  // Default sort: most recently created first.
  const [sort, setSort] = useState<SortState>({ column: 'createdAt', direction: 'desc' })

  const handleSort = useCallback((column: SortColumn) => {
    setSort((prev) => {
      if (prev.column === column) {
        // Toggle direction when the same column is clicked again.
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      // New column — default to ascending except createdAt which defaults desc.
      return { column, direction: column === 'createdAt' ? 'desc' : 'asc' }
    })
  }, [])

  const sortedNodes = useMemo(
    () => sortNodes(data.nodes, sort),
    [data.nodes, sort],
  )

  // Build a lookup map from node id → outbound link count for O(1) row access.
  // connectionCount already includes inbound references (computed server-side)
  // so we don't need to separately count links here.

  if (data.nodes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">No memories to display.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table
        className="w-full border-collapse text-sm"
        role="grid"
        aria-label="Memory relationship graph"
        aria-rowcount={data.nodes.length}
      >
        <caption className="sr-only">
          Memory relationship graph — {data.nodes.length} node{data.nodes.length !== 1 ? 's' : ''},{' '}
          {data.links.length} link{data.links.length !== 1 ? 's' : ''}.
          {data.truncated
            ? ` Showing ${data.nodes.length} of ${data.totalMemories} total memories.`
            : ''}
        </caption>

        <thead className="sticky top-0 z-10 bg-surface border-b border-border/60">
          <tr>
            <SortableHeader label="Memory" column="summary" sort={sort} onSort={handleSort} className="pl-4" />
            <SortableHeader label="Cluster" column="cluster" sort={sort} onSort={handleSort} />
            <SortableHeader
              label="Tags"
              column="tags"
              sort={sort}
              onSort={handleSort}
              className="hidden md:table-cell"
            />
            <SortableHeader
              label="Relations"
              column="connectionCount"
              sort={sort}
              onSort={handleSort}
              className="hidden md:table-cell"
            />
            <SortableHeader label="Created" column="createdAt" sort={sort} onSort={handleSort} className="pr-4" />
          </tr>
        </thead>

        <tbody>
          {sortedNodes.map((node, rowIndex) => (
            <GraphTableRow
              key={node.id}
              node={node}
              rowIndex={rowIndex}
              isFocused={node.id === focusedNodeId}
              onNodeClick={onNodeClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GraphTableRow — isolated to avoid re-rendering unfocused rows on focus change
// ---------------------------------------------------------------------------

interface GraphTableRowProps {
  node: GraphNode
  rowIndex: number
  isFocused: boolean
  onNodeClick: (nodeId: string) => void
}

function GraphTableRow({ node, rowIndex, isFocused, onNodeClick }: GraphTableRowProps) {
  const relativeTime = formatDistanceToNow(new Date(node.createdAt), { addSuffix: true })
  const tags = node.tags ?? []
  const visibleTags = tags.slice(0, 3)
  const hiddenTagCount = tags.length - visibleTags.length

  function handleClick() {
    onNodeClick(node.id)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onNodeClick(node.id)
    }
  }

  return (
    <tr
      aria-rowindex={rowIndex + 2} /* +1 for 1-based, +1 again for thead row */
      aria-selected={isFocused}
      aria-label={`Memory: ${node.summary}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={cn(
        'border-b border-border/40 cursor-pointer',
        'transition-colors duration-150',
        'hover:bg-surface-2/60',
        'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-ring',
        isFocused && 'bg-brand-cyan-950/20 ring-1 ring-inset ring-brand-cyan-500/30',
        node.is_stale && 'opacity-50',
      )}
    >
      {/* Memory summary */}
      <td className="px-3 py-3 pl-4 max-w-xs">
        <span
          className="block text-text-body leading-snug"
          title={node.summary}
        >
          {truncate(node.summary, 100)}
        </span>
      </td>

      {/* Cluster */}
      <td className="px-3 py-3 whitespace-nowrap">
        {node.cluster ? (
          <span className="inline-flex items-center gap-1.5 overflow-hidden max-w-[140px]">
            <span
              className="size-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: getClusterColor(node.cluster) }}
              aria-hidden="true"
            />
            <span
              className="truncate text-xs text-text-muted"
              title={node.cluster}
            >
              {node.cluster}
            </span>
          </span>
        ) : (
          <span className="text-xs text-text-muted italic">—</span>
        )}
      </td>

      {/* Tags — hidden on narrow screens */}
      <td className="px-3 py-3 hidden md:table-cell max-w-[200px]">
        {visibleTags.length > 0 ? (
          <span
            className="text-xs text-text-muted"
            title={tags.join(', ')}
          >
            {visibleTags.join(', ')}
            {hiddenTagCount > 0 && (
              <span className="ml-1 text-text-muted/60">+{hiddenTagCount} more</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-text-muted italic">—</span>
        )}
      </td>

      {/* Relations count badge — hidden on narrow screens */}
      <td className="px-3 py-3 hidden md:table-cell text-center">
        <span
          className={cn(
            'inline-flex items-center justify-center',
            'min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
            node.connectionCount > 0
              ? 'bg-brand-cyan-900/40 text-brand-cyan-400 border border-brand-cyan-700/40'
              : 'bg-surface-2 text-text-muted border border-border/40',
          )}
          aria-label={`${node.connectionCount} connection${node.connectionCount !== 1 ? 's' : ''}`}
        >
          {node.connectionCount}
        </span>
      </td>

      {/* Created relative time */}
      <td className="px-3 py-3 pr-4 whitespace-nowrap">
        <span
          className="text-xs text-text-muted"
          title={new Date(node.createdAt).toLocaleString()}
        >
          {relativeTime}
        </span>
      </td>
    </tr>
  )
}
