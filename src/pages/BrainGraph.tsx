import { useEffect, useMemo } from 'react'
import { Network } from 'lucide-react'
import { useGraphFilters } from '@/hooks/useGraphFilters'
import { useGraphData } from '@/hooks/useGraphData'
import { GraphFilterBar } from '@/components/graph/GraphFilterBar'
import { GraphLegend } from '@/components/graph/GraphLegend'

// ---------------------------------------------------------------------------
// BrainGraph — full-viewport page
//
// Layout model:
//   ┌─────────────────────────────────────────┐
//   │  Filter bar  (h-12, top stripe)         │
//   ├─────────────────────────────────────────┤
//   │                                         │
//   │  Main content — graph canvas or table   │ ← fills remaining height
//   │                      ┌──────────────┐   │
//   │                      │  Legend      │   │ ← bottom-right overlay
//   │                      └──────────────┘   │
//   └─────────────────────────────────────────┘
//
// The page uses `-m-6` to cancel the Shell's `p-6` padding and achieve true
// edge-to-edge coverage. This is intentional: the graph canvas needs every
// pixel of available viewport.
// ---------------------------------------------------------------------------

export default function BrainGraph() {
  const { filters, setFilter, resetFilters, focusedNodeId, setFocusedNodeId } = useGraphFilters()
  const { data, isLoading, isError } = useGraphData({
    cluster: filters.cluster,
    projectPath: filters.projectPath,
    tags: filters.tags,
    includeStale: filters.includeStale,
  })

  useEffect(() => {
    document.title = 'Brain Graph — aiBrain'
  }, [])

  // Derive the unique cluster names present in the current graph data for the
  // legend. Memoised so the legend doesn't re-sort on every render cycle.
  const presentClusters = useMemo(() => {
    if (!data?.nodes) return []
    const seen = new Set<string>()
    for (const node of data.nodes) {
      if (node.cluster) seen.add(node.cluster)
    }
    return Array.from(seen).sort()
  }, [data?.nodes])

  const displayMode = filters.displayMode ?? 'graph'

  return (
    /*
     * -m-6 counteracts the Shell's p-6 so this page bleeds to the container
     * edges. h-[calc(100vh-3.5rem)] accounts for the 14-unit (56px) header
     * height (h-14 in Shell → Header).
     */
    <div className="relative -m-6 flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <GraphFilterBar
        filters={filters}
        onFilterChange={(key, value) => setFilter(key as keyof typeof filters, value as never)}
        onReset={resetFilters}
        nodeCount={data?.nodes.length ?? 0}
        linkCount={data?.links.length ?? 0}
        truncated={data?.truncated ?? false}
        totalMemories={data?.totalMemories ?? 0}
      />

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 min-h-0">

        {/* Graph canvas / table area — takes all remaining space */}
        <main
          id="braingraph-canvas"
          className="flex flex-1 items-center justify-center"
          aria-label="Graph visualisation area"
        >
          {isLoading && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-10 h-10 rounded-full border-2 border-brand-cyan-500/30 border-t-brand-cyan-500 animate-spin"
                role="status"
                aria-label="Loading graph data…"
              />
              <p className="text-sm text-text-muted">Loading graph data…</p>
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex flex-col items-center gap-2 text-center max-w-sm px-4">
              <p className="text-sm font-medium text-brand-rose-400">
                Failed to load graph data
              </p>
              <p className="text-xs text-text-muted">
                Check that the aiBrain server is running and try refreshing.
              </p>
            </div>
          )}

          {!isLoading && !isError && data && (
            <div className="flex flex-col items-center gap-4 text-center">
              <Network className="w-16 h-16 text-brand-cyan-500/20" aria-hidden />
              <div className="space-y-1">
                <p className="text-base font-semibold text-text-heading">
                  {displayMode === 'table' ? 'Table view' : 'Graph ready'}
                </p>
                <p className="text-sm text-text-muted">
                  {data.nodes.length} node{data.nodes.length !== 1 ? 's' : ''},{' '}
                  {data.links.length} link{data.links.length !== 1 ? 's' : ''}
                </p>
                {focusedNodeId && (
                  <p className="text-xs text-brand-cyan-400">
                    Focused: <span className="font-mono">{focusedNodeId}</span>
                    <button
                      type="button"
                      onClick={() => setFocusedNodeId(undefined)}
                      className="ml-2 underline hover:no-underline text-text-muted hover:text-text-body transition-colors"
                    >
                      clear
                    </button>
                  </p>
                )}
              </div>
              <p className="text-xs text-text-muted max-w-xs">
                The 3D/2D force-directed renderer will mount here in Phase 13.
              </p>
            </div>
          )}

          {!isLoading && !isError && !data && (
            <p className="text-sm text-text-muted">No graph data available.</p>
          )}
        </main>

        {/* ── Legend overlay ──────────────────────────────────────────── */}
        {!isLoading && !isError && data && (
          <GraphLegend clusters={presentClusters} />
        )}

        {/* Node detail Sheet — reserved slot, implemented in Phase 14 */}
        {/*
          <Sheet open={!!focusedNodeId} onOpenChange={(open) => { if (!open) setFocusedNodeId(undefined) }}>
            <SheetContent side="right" className="w-[400px]">
              ...NodeDetailPanel
            </SheetContent>
          </Sheet>
        */}
      </div>
    </div>
  )
}
