import { useRef, useState, useEffect, useCallback, lazy, Suspense } from 'react'
import type { MutableRefObject } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d'
import type { GraphData, GraphNode, GraphLink } from '@/types/memory'
import { getClusterColor } from '@/lib/cluster-colors'
import { useGraphAnimation, HOVER_LERP_SPEED, HOVER_SCALE } from './useGraphAnimation'

// ---------------------------------------------------------------------------
// Lazy-load the 3D renderer so three.js (~600 kB) is never shipped to users
// who only ever use 2D mode. The import() fires only when viewMode === '3d'.
// ---------------------------------------------------------------------------
const ForceGraph3D = lazy(() => import('react-force-graph-3d'))

// ---------------------------------------------------------------------------
// Edge color palette — mirrors the relation-type semantics used across the UI
// ---------------------------------------------------------------------------
const EDGE_COLORS: Record<GraphLink['relation_type'], string> = {
  supersedes: '#ff6b6b',  // rose    — one memory replaces another
  'caused-by': '#ffd93d', // amber   — consequence relationship
  'see-also': '#3b82f6',  // blue    — loose association
  'follow-up': '#10b981', // emerald — continuation
  similar: '#6b7280',     // gray    — weak similarity signal
}

// Human-readable display labels for relation types shown in hover pills
const RELATION_LABELS: Record<GraphLink['relation_type'], string> = {
  supersedes: 'Supersedes',
  'caused-by': 'Caused By',
  'see-also': 'See Also',
  'follow-up': 'Follow-up',
  similar: 'Similar',
}

// Relation types that carry directional meaning and warrant arrow decoration
const DIRECTED_TYPES = new Set<GraphLink['relation_type']>(['supersedes', 'caused-by'])

// ---------------------------------------------------------------------------
// Node sizing helpers
// ---------------------------------------------------------------------------
const NODE_MIN_RADIUS = 8   // was 4 — increased for better visual presence
const NODE_MAX_EXTRA = 28   // was 16 — connectionCount * 2 capped at this

function nodeRadius(connectionCount: number): number {
  return NODE_MIN_RADIUS + Math.min(connectionCount * 2, NODE_MAX_EXTRA)
}

// ---------------------------------------------------------------------------
// The library attaches simulation coordinates (x, y) to node objects at
// runtime. We read those from raw NodeObject which already has x/y as
// optional fields in the type definition.
//
// To access our domain fields (cluster, connectionCount, etc.) inside library
// callbacks, we cast the raw NodeObject through `unknown` to GraphNode.
// This is intentional — the library's index signature ([others: string]: any)
// means the fields are always present at runtime, just not in the static type.
// ---------------------------------------------------------------------------

// Unparameterised library types — what the callbacks actually receive
type RawNode = NodeObject
type RawLink = LinkObject

// Helpers to extract our domain fields from a raw library node/link
function asGraphNode(raw: RawNode): GraphNode & { x?: number; y?: number } {
  return raw as unknown as GraphNode & { x?: number; y?: number }
}
function asGraphLink(raw: RawLink): GraphLink {
  return raw as unknown as GraphLink
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ForceGraphCanvasProps {
  data: GraphData
  viewMode: '2d' | '3d'
  focusedNodeId?: string
  onNodeClick: (nodeId: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ForceGraphCanvas({
  data,
  viewMode,
  focusedNodeId,
  onNodeClick,
}: ForceGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Unparameterised ref matches the default generic of ForceGraph2D
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined) as MutableRefObject<ForceGraphMethods | undefined>

  const { nodeAnimState, cursorGraphPos, requestRefresh, keepAlive, prefersReducedMotion } = useGraphAnimation(graphRef)

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [hoveredNodeId, setHoveredNodeId] = useState<string | undefined>()
  const [hoveredLinkId, setHoveredLinkId] = useState<string | undefined>()

  // Clear stale hover state when switching between 2D/3D modes
  useEffect(() => {
    setHoveredNodeId(undefined)
    setHoveredLinkId(undefined)
  }, [viewMode])

  // Track container size with a ResizeObserver so the canvas always fills its
  // parent regardless of how the layout shifts around it.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setDimensions({ width, height })
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // When the focused node changes, animate the 2D camera to center on it.
  // We defer by one tick so the simulation has assigned x/y before we read them.
  useEffect(() => {
    if (!focusedNodeId || viewMode !== '2d') return
    const graph = graphRef.current
    if (!graph) return

    const timer = setTimeout(() => {
      const rawNode = data.nodes.find((n) => n.id === focusedNodeId)
      if (!rawNode) return
      // The simulation attaches x/y at runtime; they're not in our static type
      const node = rawNode as GraphNode & { x?: number; y?: number }
      if (node.x !== undefined && node.y !== undefined) {
        graph.centerAt(node.x, node.y, 600)
        graph.zoom(3, 600)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [focusedNodeId, data.nodes, viewMode])

  // ---------------------------------------------------------------------------
  // Node canvas render (2D only)
  //
  // Each node is drawn as a filled circle using the cluster color.
  // Hover state drives a smooth lerp on the radius multiplier stored in
  // nodeAnimState. The glow ring uses ctx.shadow* to create a soft halo
  // using the cluster colour. Focused nodes get a pulsing cyan outer ring
  // (sine wave on ring radius). Stale nodes are drawn at reduced opacity
  // (0.45) with a dashed ring so they remain identifiable. Summary labels
  // appear when globalScale > 1.8 (user has zoomed in enough).
  // All animations respect prefers-reduced-motion.
  // ---------------------------------------------------------------------------
  const renderNode = useCallback(
    (raw: RawNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = asGraphNode(raw)
      const isFocused = node.id === focusedNodeId
      const isHovered = node.id === hoveredNodeId
      const nodeId = node.id ?? ''
      const clusterColor = getClusterColor(node.cluster ?? 'unclustered')

      // -- Lerp the radius multiplier toward its target ----------------------
      const target = isHovered ? HOVER_SCALE : 1.0
      const current = nodeAnimState.current.get(nodeId) ?? 1.0
      let animMultiplier: number

      if (prefersReducedMotion.current) {
        animMultiplier = target
      } else {
        animMultiplier = current + (target - current) * HOVER_LERP_SPEED
        if (Math.abs(animMultiplier - target) < 0.005) animMultiplier = target
      }

      if (animMultiplier !== target) {
        nodeAnimState.current.set(nodeId, animMultiplier)
        keepAlive.current = true
        requestRefresh()
      } else if (animMultiplier !== 1.0) {
        nodeAnimState.current.set(nodeId, animMultiplier)
      } else {
        nodeAnimState.current.delete(nodeId)
      }

      const baseRadius = nodeRadius(node.connectionCount ?? 0)
      const displayRadius = (baseRadius * animMultiplier) / globalScale

      const x = node.x ?? 0
      const y = node.y ?? 0

      ctx.save()
      // Stale nodes: raised from 0.3 → 0.45 for better readability
      ctx.globalAlpha = node.is_stale ? 0.45 : 1

      // -- Focused ring with sine pulse -------------------------------------
      // The pulse expands/contracts the ring radius using sin(time). When
      // prefers-reduced-motion is on, the ring is static (pulseOffset = 0).
      if (isFocused) {
        const pulseOffset = prefersReducedMotion.current
          ? 0
          : Math.sin(performance.now() * 0.003) * (3 / globalScale)

        // Signal the rAF loop to keep firing so the pulse continues animating
        keepAlive.current = true
        requestRefresh()

        ctx.beginPath()
        ctx.arc(x, y, displayRadius + (4 / globalScale) + pulseOffset, 0, 2 * Math.PI)
        ctx.strokeStyle = '#00d9ff'
        ctx.lineWidth = 2 / globalScale
        ctx.stroke()
      }

      // Glow halo — applied when hovered or focused; reset in ctx.restore()
      if (isHovered || isFocused) {
        ctx.shadowColor = isHovered ? clusterColor : '#00d9ff'
        ctx.shadowBlur = (isHovered ? 16 : 10) * animMultiplier
      }

      // Node body
      ctx.beginPath()
      ctx.arc(x, y, displayRadius, 0, 2 * Math.PI)
      ctx.fillStyle = clusterColor
      ctx.fill()

      // -- Stale dashed ring ------------------------------------------------
      // Drawn after the fill so it's always visible on top of the node body.
      // Uses the cluster color so it reads as "same node, degraded state".
      if (node.is_stale) {
        ctx.setLineDash([3 / globalScale, 3 / globalScale])
        ctx.beginPath()
        ctx.arc(x, y, displayRadius + 2 / globalScale, 0, 2 * Math.PI)
        ctx.strokeStyle = clusterColor
        ctx.lineWidth = 1 / globalScale
        ctx.stroke()
        ctx.setLineDash([])
      }

      ctx.restore()

      // -- Zoom-based summary label ------------------------------------------
      // Drawn outside save/restore so the label alpha doesn't inherit the
      // stale dimming — labels should be fully legible regardless of staleness.
      if (globalScale > 1.8) {
        const summary = node.summary ?? ''
        if (summary) {
          const maxChars = 28
          const label = summary.length > maxChars ? summary.slice(0, maxChars - 1) + '…' : summary
          const fontSize = 4 / globalScale
          ctx.font = `${fontSize}px sans-serif`
          ctx.fillStyle = 'rgba(255,255,255,0.75)'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(label, x, y + displayRadius + 2 / globalScale)
        }
      }
    },
    [focusedNodeId, hoveredNodeId, nodeAnimState, keepAlive, requestRefresh, prefersReducedMotion],
  )

  // ---------------------------------------------------------------------------
  // Shared accessor callbacks
  // ---------------------------------------------------------------------------

  const nodeLabel = useCallback(
    (raw: RawNode) => asGraphNode(raw).summary ?? '',
    [],
  )

  const nodeColor = useCallback(
    (raw: RawNode) => getClusterColor(asGraphNode(raw).cluster ?? 'unclustered'),
    [],
  )

  const linkColor = useCallback(
    (raw: RawLink) => EDGE_COLORS[asGraphLink(raw).relation_type] ?? '#6b7280',
    [],
  )

  const linkArrowLength = useCallback(
    (raw: RawLink) => (DIRECTED_TYPES.has(asGraphLink(raw).relation_type) ? 4 : 0),
    [],
  )

  // ---------------------------------------------------------------------------
  // Interaction handlers
  // ---------------------------------------------------------------------------

  const handleNodeClick = useCallback(
    (raw: RawNode) => {
      const id = asGraphNode(raw).id
      if (id) onNodeClick(id)
    },
    [onNodeClick],
  )

  const handleNodeHover = useCallback(
    (raw: RawNode | null) => {
      setHoveredNodeId(raw ? (asGraphNode(raw).id ?? undefined) : undefined)
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // The library needs explicit width/height. Defer render until the container
  // has been measured to avoid the library initialising at size 0.
  // ---------------------------------------------------------------------------
  const ready = dimensions.width > 0 && dimensions.height > 0

  // Cast our domain GraphData to the library's expected shape. The library only
  // reads fields it knows about (id, source, target) and stores everything else
  // via the index signature, so the cast is safe at runtime.
  const rawGraphData = data as unknown as Parameters<typeof ForceGraph2D>[0]['graphData']

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const graph = graphRef.current
      if (!graph || viewMode !== '2d') return
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      cursorGraphPos.current = graph.screen2GraphCoords(screenX, screenY)
    },
    [graphRef, cursorGraphPos, viewMode],
  )

  const handleMouseLeave = useCallback(() => {
    cursorGraphPos.current = null
  }, [cursorGraphPos])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      role="img"
      aria-label="Memory relationship graph — use Table view for keyboard navigation"
      tabIndex={-1}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {ready && viewMode === '2d' && (
        <ForceGraph2D
          ref={graphRef}
          graphData={rawGraphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          warmupTicks={50}
          cooldownTicks={200}
          cooldownTime={5000}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={renderNode}
          nodeLabel={nodeLabel}
          nodeColor={nodeColor}
          linkColor={linkColor}
          linkWidth={1}
          linkDirectionalArrowLength={linkArrowLength}
          linkDirectionalArrowRelPos={1}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
        />
      )}
      {ready && viewMode === '3d' && (
        <Suspense fallback={null}>
          <ForceGraph3D
            graphData={data as unknown as Parameters<typeof ForceGraph3D>[0]['graphData']}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            warmupTicks={50}
            cooldownTicks={200}
            cooldownTime={5000}
            showNavInfo={false}
            nodeOpacity={0.9}
            nodeLabel={nodeLabel as Parameters<typeof ForceGraph3D>[0]['nodeLabel']}
            nodeColor={nodeColor as Parameters<typeof ForceGraph3D>[0]['nodeColor']}
            linkColor={linkColor as Parameters<typeof ForceGraph3D>[0]['linkColor']}
            linkWidth={1}
            linkDirectionalArrowLength={linkArrowLength as Parameters<typeof ForceGraph3D>[0]['linkDirectionalArrowLength']}
            linkDirectionalArrowRelPos={1}
            onNodeClick={handleNodeClick as Parameters<typeof ForceGraph3D>[0]['onNodeClick']}
          />
        </Suspense>
      )}
    </div>
  )
}
