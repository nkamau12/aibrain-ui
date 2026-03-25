import { useRef, useState, useEffect, useCallback, lazy, Suspense } from 'react'
import type { MutableRefObject } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d'
import type { GraphData, GraphNode, GraphLink } from '@/types/memory'
import { getClusterColor } from '@/lib/cluster-colors'
import { useGraphAnimation } from './useGraphAnimation'

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

  const { cursorGraphPos } = useGraphAnimation(graphRef)

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
  // Focused nodes get a bright outer ring; hovered nodes scale up 1.5×.
  // Stale nodes are drawn at reduced opacity.
  // ---------------------------------------------------------------------------
  const renderNode = useCallback(
    (raw: RawNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = asGraphNode(raw)
      const isFocused = node.id === focusedNodeId
      const isHovered = node.id === hoveredNodeId

      const baseRadius = nodeRadius(node.connectionCount ?? 0)
      const displayRadius = isHovered ? baseRadius * 1.5 : baseRadius

      const x = node.x ?? 0
      const y = node.y ?? 0

      ctx.save()
      ctx.globalAlpha = node.is_stale ? 0.3 : 1

      // Focused ring — rendered before the fill so it sits behind the node body
      if (isFocused) {
        ctx.beginPath()
        ctx.arc(x, y, (displayRadius + 4) / globalScale, 0, 2 * Math.PI)
        ctx.strokeStyle = '#00d9ff'
        ctx.lineWidth = 2 / globalScale
        ctx.stroke()
      }

      // Node body
      ctx.beginPath()
      ctx.arc(x, y, displayRadius / globalScale, 0, 2 * Math.PI)
      ctx.fillStyle = getClusterColor(node.cluster ?? 'unclustered')
      ctx.fill()

      ctx.restore()
    },
    [focusedNodeId, hoveredNodeId],
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
