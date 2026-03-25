import { useEffect } from 'react'
import { Network } from 'lucide-react'
import { useGraphFilters } from '@/hooks/useGraphFilters'
import { useGraphData } from '@/hooks/useGraphData'
import { GraphTableView } from '@/components/graph/GraphTableView'

// ---------------------------------------------------------------------------
// BrainGraph — full-viewport scaffold
//
// Layout model:
//   ┌─────────────────────────────────────────┐
//   │  Filter bar  (h-12, top stripe)         │
//   ├─────────────────────────────────────────┤
//   │                                         │
//   │  Main content — graph canvas or table   │ ← fills remaining height
//   │                                         │
//   └─────────────────────────────────────────┘
//
// A Sheet overlay for node detail is reserved at the right edge. The graph
// renderer (Phase 13/14) will mount into #braingraph-canvas once added.
//
// The page uses `-m-6` to cancel the Shell's `p-6` padding and achieve true
// edge-to-edge coverage. This is intentional: the graph canvas needs every
// pixel of available viewport.
// ---------------------------------------------------------------------------

export default function BrainGraph() {
  // setFilter and resetFilters are consumed by the FilterBar in Phase 13.
  // Prefixed with _ to satisfy the TypeScript no-unused-vars rule while
  // keeping them destructured here so the compiler verifies their types.
  const { filters, setFilter: _setFilter, resetFilters: _resetFilters, focusedNodeId, setFocusedNodeId } = useGraphFilters()
  const { data, isLoading, isError } = useGraphData({
    cluster: filters.cluster,
    projectPath: filters.projectPath,
    tags: filters.tags,
    includeStale: filters.includeStale,
  })

  useEffect(() => {
    document.title = 'Brain Graph — aiBrain'
  }, [])

  // The display mode defaults to 'graph' when not specified in the URL.
  const displayMode = filters.displayMode ?? 'graph'
  const viewMode = filters.viewMode ?? '2d'

  return (
    /*
     * -m-6 counteracts the Shell's p-6 so this page bleeds to the container
     * edges. h-[calc(100vh-3.5rem)] accounts for the 14-unit (56px) header
     * height (h-14 in Shell → Header).
     */
    <div className="relative -m-6 flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 h-12 shrink-0 border-b border-border bg-surface/80 backdrop-blur-sm">
        <Network className="w-4 h-4 text-brand-cyan-500 shrink-0" aria-hidden />
        <h1 className="text-sm font-semibold text-text-heading tracking-tight">
          Brain Graph
        </h1>

        {/* Divider */}
        <div className="w-px h-4 bg-border" aria-hidden />

        {/* Placeholder: FilterBar component will mount here in a later phase */}
        <p className="text-xs text-text-muted">
          Filter bar — coming in Phase 13
        </p>

        {/* Push mode toggles to the right */}
        <div className="ml-auto flex items-center gap-2">
          {/* Placeholder: ViewMode / DisplayMode toggles */}
          <span className="text-xs text-text-muted">
            Mode: <span className="text-text-body">{viewMode.toUpperCase()}</span>
          </span>
          <span className="text-xs text-text-muted">
            View: <span className="text-text-body capitalize">{displayMode}</span>
          </span>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 min-h-0">

        {/* Graph canvas / table area — takes all remaining space */}
        <main
          id="braingraph-canvas"
          className={
            displayMode === 'table'
              ? 'flex flex-col flex-1 min-h-0 overflow-hidden'
              : 'flex flex-1 items-center justify-center'
          }
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

          {!isLoading && !isError && data && displayMode === 'table' && (
            <GraphTableView
              data={data}
              onNodeClick={setFocusedNodeId}
              focusedNodeId={focusedNodeId ?? undefined}
            />
          )}

          {!isLoading && !isError && data && displayMode !== 'table' && (
            <div className="flex flex-col items-center gap-4 text-center">
              {/* Stats placeholder — gives orientation while the renderer is wired up */}
              <Network className="w-16 h-16 text-brand-cyan-500/20" aria-hidden />
              <div className="space-y-1">
                <p className="text-base font-semibold text-text-heading">
                  Graph ready
                </p>
                <p className="text-sm text-text-muted">
                  {data.nodes.length} node{data.nodes.length !== 1 ? 's' : ''},{' '}
                  {data.links.length} link{data.links.length !== 1 ? 's' : ''}
                </p>
                {data.truncated && (
                  <p className="text-xs text-brand-amber-400">
                    Showing {data.nodes.length} of {data.totalMemories} memories —
                    apply filters to narrow the view
                  </p>
                )}
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
