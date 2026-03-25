import { useEffect, useMemo } from 'react'
import { Network } from 'lucide-react'
import { NodeDetailSheet } from '@/components/graph/NodeDetailSheet'
import { useGraphFilters } from '@/hooks/useGraphFilters'
import { useGraphData } from '@/hooks/useGraphData'
import ForceGraphCanvas from '@/components/graph/ForceGraphCanvas'
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
// A Sheet overlay for node detail is reserved at the right edge.
//
// The page uses `-m-6` to cancel the Shell's `p-6` padding and achieve true
// edge-to-edge coverage. This is intentional: the graph canvas needs every
// pixel of available viewport.
// ---------------------------------------------------------------------------

export default function BrainGraph() {
  const { filters, setFilter: _setFilter, resetFilters: _resetFilters, focusedNodeId, setFocusedNodeId } = useGraphFilters()
  const { data, isLoading, isError } = useGraphData({
    cluster: filters.cluster,
    projectPath: filters.projectPath,
    tags: filters.tags,
    includeStale: filters.includeStale,
  })

  // Resolve the focused node from the graph dataset so the sheet has full
  // node data without an additional API call. Returns null when the graph
  // hasn't loaded yet or when no node is focused.
  const focusedNode = useMemo(() => {
    if (!focusedNodeId || !data?.nodes) return null
    return data.nodes.find((n) => n.id === focusedNodeId) ?? null
  }, [focusedNodeId, data?.nodes])

  useEffect(() => {
    document.title = 'Brain Graph — aiBrain'
  }, [])

  const displayMode = filters.displayMode ?? 'graph'
  const viewMode = filters.viewMode ?? '2d'

  return (
    <div className="relative -m-6 flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 h-12 shrink-0 border-b border-border bg-surface/80 backdrop-blur-sm">
        <Network className="w-4 h-4 text-brand-cyan-500 shrink-0" aria-hidden />
        <h1 className="text-sm font-semibold text-text-heading tracking-tight">
          Brain Graph
        </h1>

        <div className="w-px h-4 bg-border" aria-hidden />

        <p className="text-xs text-text-muted">
          Filter bar — coming in assembly phase
        </p>

        <div className="ml-auto flex items-center gap-2">
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
            <>
              {data.truncated && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-surface/90 border border-border backdrop-blur-sm">
                  <p className="text-xs text-brand-amber-400">
                    Showing {data.nodes.length} of {data.totalMemories} memories — apply filters to narrow the view
                  </p>
                </div>
              )}
              <ForceGraphCanvas
                data={data}
                viewMode={viewMode}
                focusedNodeId={focusedNodeId}
                onNodeClick={setFocusedNodeId}
              />
            </>
          )}

          {!isLoading && !isError && !data && (
            <p className="text-sm text-text-muted">No graph data available.</p>
          )}
        </main>

        {/* Node detail Sheet — slides in from the right when a node is focused */}
        <NodeDetailSheet
          node={focusedNode}
          open={!!focusedNodeId}
          onOpenChange={(open) => { if (!open) setFocusedNodeId(undefined) }}
        />
      </div>
    </div>
  )
}
