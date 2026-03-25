import { useRef, useState, useEffect, useCallback, lazy, Suspense } from 'react'
import type { MutableRefObject } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d'
import type { ForceGraphMethods as ForceGraph3DMethods } from 'react-force-graph-3d'
import * as THREE from 'three'
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
  // 3D graph instance — typed separately since ForceGraph3DMethods differs from 2D
  const graph3dRef = useRef<ForceGraph3DMethods | undefined>(undefined) as MutableRefObject<ForceGraph3DMethods | undefined>
  // Ref mirror of hoveredNodeId — prevents stale closure in render3DNode without
  // forcing it to re-memoize on every hover change (which would recreate all meshes)
  const hoveredNodeIdRef = useRef<string | undefined>(undefined)

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
  // using the cluster colour. Focused nodes get an additional cyan outer ring.
  // Stale nodes are drawn at reduced opacity.
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
        // Snap immediately — no animation
        animMultiplier = target
      } else {
        animMultiplier = current + (target - current) * HOVER_LERP_SPEED
        // Snap when close enough to avoid infinite micro-steps
        if (Math.abs(animMultiplier - target) < 0.005) animMultiplier = target
      }

      // Persist the animated value and signal the rAF loop if still moving
      if (animMultiplier !== target) {
        nodeAnimState.current.set(nodeId, animMultiplier)
        keepAlive.current = true
        requestRefresh()
      } else if (animMultiplier !== 1.0) {
        // At a non-resting stable target (e.g. HOVER_SCALE) — keep the entry
        nodeAnimState.current.set(nodeId, animMultiplier)
      } else {
        // Fully at rest — remove to keep the map lean
        nodeAnimState.current.delete(nodeId)
      }

      const baseRadius = nodeRadius(node.connectionCount ?? 0)
      const displayRadius = (baseRadius * animMultiplier) / globalScale

      const x = node.x ?? 0
      const y = node.y ?? 0

      ctx.save()
      ctx.globalAlpha = node.is_stale ? 0.3 : 1

      // Focused ring — rendered before the fill so it sits behind the node body
      if (isFocused) {
        ctx.beginPath()
        ctx.arc(x, y, displayRadius + 4 / globalScale, 0, 2 * Math.PI)
        ctx.strokeStyle = '#00d9ff'
        ctx.lineWidth = 2 / globalScale
        ctx.stroke()
      }

      // Glow effect — applied only when hovered or focused so idle nodes are
      // drawn without shadow overhead. The shadow is reset in ctx.restore().
      if (isHovered || isFocused) {
        ctx.shadowColor = isHovered ? clusterColor : '#00d9ff'
        ctx.shadowBlur = (isHovered ? 16 : 10) * animMultiplier
      }

      // Node body
      ctx.beginPath()
      ctx.arc(x, y, displayRadius, 0, 2 * Math.PI)
      ctx.fillStyle = clusterColor
      ctx.fill()

      ctx.restore()
    },
    // hoveredNodeId drives the lerp target; focusedNodeId drives the ring.
    // The animation refs (nodeAnimState, keepAlive, requestRefresh,
    // prefersReducedMotion) are stable refs — no need to list them.
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
  // Link canvas painter (2D only)
  //
  // Replaces the default line renderer so we can control stroke width and
  // draw a label pill on hover. The library resolves source/target to full
  // node objects by the time this callback fires, so we cast them to access
  // simulation x/y coordinates.
  // ---------------------------------------------------------------------------
  const renderLink = useCallback(
    (raw: RawLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const link = asGraphLink(raw)
      // Library resolves source/target from id strings to node objects at runtime
      const sourceNode = raw.source as unknown as GraphNode & { x?: number; y?: number }
      const targetNode = raw.target as unknown as GraphNode & { x?: number; y?: number }

      const sx = sourceNode.x ?? 0
      const sy = sourceNode.y ?? 0
      const tx = targetNode.x ?? 0
      const ty = targetNode.y ?? 0

      // Build a stable id from the original string ids on our domain type
      const linkId = `${link.source}-${link.target}`
      const isHovered = linkId === hoveredLinkId
      const color = EDGE_COLORS[link.relation_type] ?? '#6b7280'

      ctx.save()

      // Edge line — full color on hover, 60% opacity otherwise
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.strokeStyle = isHovered ? color : `${color}99`
      ctx.lineWidth = isHovered ? 2.5 / globalScale : 2 / globalScale
      ctx.stroke()

      // Label pill at midpoint — only when hovered
      if (isHovered) {
        const mx = (sx + tx) / 2
        const my = (sy + ty) / 2
        const label = RELATION_LABELS[link.relation_type] ?? link.relation_type

        const fontSize = 10 / globalScale
        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`

        const textWidth = ctx.measureText(label).width
        const paddingH = 6 / globalScale
        const paddingV = 3 / globalScale
        const pillW = textWidth + paddingH * 2
        const pillH = fontSize + paddingV * 2
        const cornerRadius = 4 / globalScale

        const pillX = mx - pillW / 2
        const pillY = my - pillH / 2

        // Pill background
        ctx.beginPath()
        ctx.roundRect(pillX, pillY, pillW, pillH, cornerRadius)
        ctx.fillStyle = 'rgba(10,15,25,0.92)'
        ctx.fill()

        // Colored border matching the edge
        ctx.strokeStyle = color
        ctx.lineWidth = 1 / globalScale
        ctx.stroke()

        // Label text
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, mx, my)
      }

      ctx.restore()
    },
    [hoveredLinkId],
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

  // Keep the ref in sync so render3DNode reads the current value without
  // needing to be re-memoized on every hover change.
  useEffect(() => {
    hoveredNodeIdRef.current = hoveredNodeId
  }, [hoveredNodeId])

  // ---------------------------------------------------------------------------
  // 3D node renderer — returns a THREE.Mesh for each node.
  // ---------------------------------------------------------------------------
  const render3DNode = useCallback(
    (raw: RawNode): THREE.Object3D => {
      const node = asGraphNode(raw)
      const isHovered = node.id === hoveredNodeIdRef.current
      const clusterColor = getClusterColor(node.cluster ?? 'unclustered')

      const radius = nodeRadius(node.connectionCount ?? 0) * 0.5
      const geometry = new THREE.SphereGeometry(isHovered ? radius * 1.5 : radius, 16, 12)

      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(clusterColor),
        transparent: true,
        opacity: node.is_stale ? 0.45 : 0.9,
      })

      if (isHovered) {
        material.emissive = new THREE.Color(clusterColor)
        material.emissiveIntensity = 0.3
      }

      return new THREE.Mesh(geometry, material)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // ---------------------------------------------------------------------------
  // Fog setup — fires once after the 3D physics engine finishes its warmup.
  // ---------------------------------------------------------------------------
  const handle3DEngineStop = useCallback(() => {
    const graph = graph3dRef.current
    if (!graph) return
    const scene = graph.scene()
    if (scene && !scene.fog) {
      scene.fog = new THREE.FogExp2(0x0a0f19, 0.008)
    }
  }, [])

  const handleLinkHover = useCallback(
    (raw: RawLink | null) => {
      if (!raw) {
        setHoveredLinkId(undefined)
        return
      }
      const link = asGraphLink(raw)
      setHoveredLinkId(`${link.source}-${link.target}`)
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
          linkCanvasObject={renderLink}
          linkCanvasObjectMode={() => 'replace'}
          linkWidth={2}
          linkDirectionalArrowLength={linkArrowLength}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.004}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onLinkHover={handleLinkHover}
        />
      )}
      {ready && viewMode === '3d' && (
        <Suspense fallback={null}>
          <ForceGraph3D
            ref={graph3dRef as Parameters<typeof ForceGraph3D>[0]['ref']}
            graphData={data as unknown as Parameters<typeof ForceGraph3D>[0]['graphData']}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            warmupTicks={50}
            cooldownTicks={200}
            cooldownTime={5000}
            showNavInfo={false}
            nodeLabel={nodeLabel as Parameters<typeof ForceGraph3D>[0]['nodeLabel']}
            nodeThreeObject={render3DNode as Parameters<typeof ForceGraph3D>[0]['nodeThreeObject']}
            nodeThreeObjectExtend={false}
            linkColor={linkColor as Parameters<typeof ForceGraph3D>[0]['linkColor']}
            linkWidth={2}
            linkDirectionalArrowLength={linkArrowLength as Parameters<typeof ForceGraph3D>[0]['linkDirectionalArrowLength']}
            linkDirectionalArrowRelPos={1}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.004}
            onNodeClick={handleNodeClick as Parameters<typeof ForceGraph3D>[0]['onNodeClick']}
            onNodeHover={handleNodeHover as Parameters<typeof ForceGraph3D>[0]['onNodeHover']}
            onEngineStop={handle3DEngineStop}
          />
        </Suspense>
      )}
    </div>
  )
}
