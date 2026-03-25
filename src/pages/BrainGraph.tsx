import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { useGraphFilters } from '@/hooks/useGraphFilters'
import { useGraphData } from '@/hooks/useGraphData'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import ForceGraphCanvas from '@/components/graph/ForceGraphCanvas'
import { GraphTableView } from '@/components/graph/GraphTableView'
import { NodeDetailSheet } from '@/components/graph/NodeDetailSheet'
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

const GRAPH_TOOLTIP_SEEN_KEY = 'aibrain-graph-tooltip-seen'

export default function BrainGraph() {
  const { filters, setFilter, resetFilters, focusedNodeId, setFocusedNodeId } = useGraphFilters()
  const { data, isLoading, isError } = useGraphData({
    cluster: filters.cluster,
    projectPath: filters.projectPath,
    tags: filters.tags,
    includeStale: filters.includeStale,
  })

  // ---------------------------------------------------------------------------
  // Mobile auto-fallback — screens < 768px switch to table mode automatically
  // ---------------------------------------------------------------------------
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [mobileBannerDismissed, setMobileBannerDismissed] = useState(false)

  // When the viewport first enters mobile range, auto-switch to table mode.
  // We only do this once per transition to avoid fighting against deliberate
  // user choices once they've dismissed the banner.
  const didAutoSwitchRef = useRef(false)
  useEffect(() => {
    if (isMobile && !didAutoSwitchRef.current) {
      setFilter('displayMode', 'table')
      didAutoSwitchRef.current = true
    }
    if (!isMobile) {
      // Reset the flag so we re-apply if the user resizes back to mobile.
      didAutoSwitchRef.current = false
      setMobileBannerDismissed(false)
    }
  }, [isMobile, setFilter])

  // ---------------------------------------------------------------------------
  // First-visit tooltip — shown on first graph-mode visit, dismissed after 5s
  // or on click, never shown in table mode.
  // ---------------------------------------------------------------------------
  const [tooltipVisible, setTooltipVisible] = useState(false)

  const dismissTooltip = useCallback(() => {
    setTooltipVisible(false)
    localStorage.setItem(GRAPH_TOOLTIP_SEEN_KEY, '1')
  }, [])

  const displayMode = filters.displayMode ?? 'graph'
  const viewMode = filters.viewMode ?? '2d'

  useEffect(() => {
    if (displayMode !== 'graph') return
    if (localStorage.getItem(GRAPH_TOOLTIP_SEEN_KEY)) return
    setTooltipVisible(true)
    const timer = setTimeout(dismissTooltip, 5000)
    return () => clearTimeout(timer)
  }, [displayMode, dismissTooltip])

  // ---------------------------------------------------------------------------
  // Keyboard focus management for the NodeDetailSheet
  // ---------------------------------------------------------------------------
  // We hold a ref to the canvas area so we can return focus there on Sheet close.
  const graphAreaRef = useRef<HTMLDivElement>(null)

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setFocusedNodeId(undefined)
        // Return focus to the graph area after the Sheet finishes its exit
        // animation. A short delay ensures the Sheet has unmounted its focus
        // trap before we move focus.
        setTimeout(() => {
          graphAreaRef.current?.focus()
        }, 50)
      }
    },
    [setFocusedNodeId],
  )

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  // Resolve the focused node from the graph dataset so the sheet has full
  // node data without an additional API call.
  const focusedNode = useMemo(() => {
    if (!focusedNodeId || !data?.nodes) return null
    return data.nodes.find((n) => n.id === focusedNodeId) ?? null
  }, [focusedNodeId, data?.nodes])

  // Derive unique cluster names present in the current graph data for the legend.
  const presentClusters = useMemo(() => {
    if (!data?.nodes) return []
    const seen = new Set<string>()
    for (const node of data.nodes) {
      if (node.cluster) seen.add(node.cluster)
    }
    return Array.from(seen).sort()
  }, [data?.nodes])

  useEffect(() => {
    document.title = 'Brain Graph — aiBrain'
  }, [])

  const showMobileBanner = isMobile && displayMode === 'table' && !mobileBannerDismissed

  return (
    <div className="relative -m-6 flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">

      {/* ── Mobile "desktop-only graph" banner ──────────────────────────── */}
      {showMobileBanner && (
        <div
          role="status"
          aria-live="polite"
          className="
            flex items-center justify-between gap-2
            px-4 py-2 shrink-0
            bg-brand-cyan-950/60 border-b border-brand-cyan-700/40
            text-xs text-brand-cyan-300
          "
        >
          <span>Graph view is available on desktop</span>
          <button
            type="button"
            onClick={() => setMobileBannerDismissed(true)}
            aria-label="Dismiss banner"
            className="
              shrink-0 p-0.5 rounded
              text-brand-cyan-400/70 hover:text-brand-cyan-300
              transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-cyan-500/50
            "
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

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

        <main
          id="braingraph-canvas"
          ref={graphAreaRef}
          tabIndex={-1}
          className={
            displayMode === 'table'
              ? 'flex flex-col flex-1 min-h-0 overflow-hidden focus-visible:outline-none'
              : 'flex flex-1 items-center justify-center focus-visible:outline-none'
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

              {/* ── First-visit tooltip ─────────────────────────────── */}
              {tooltipVisible && (
                <button
                  type="button"
                  onClick={dismissTooltip}
                  aria-label="Dismiss tip"
                  className="
                    absolute bottom-20 left-1/2 -translate-x-1/2 z-20
                    px-4 py-2 rounded-full
                    bg-surface/95 border border-border backdrop-blur-sm shadow-lg
                    text-xs text-text-muted
                    cursor-pointer
                    transition-opacity duration-300
                    focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
                  "
                >
                  Drag to explore, scroll to zoom, click a node to inspect
                </button>
              )}
            </>
          )}

          {!isLoading && !isError && !data && (
            <p className="text-sm text-text-muted">No graph data available.</p>
          )}
        </main>

        {/* ── Legend overlay ──────────────────────────────────────────── */}
        {!isLoading && !isError && data && displayMode !== 'table' && (
          <GraphLegend clusters={presentClusters} />
        )}

        {/* Node detail Sheet — slides in from the right when a node is focused */}
        <NodeDetailSheet
          node={focusedNode}
          open={!!focusedNodeId}
          onOpenChange={handleSheetOpenChange}
        />
      </div>
    </div>
  )
}
