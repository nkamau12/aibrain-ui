import { useRef, useState, useEffect, useCallback, lazy, Suspense } from 'react'
import type { MutableRefObject } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d'
import type { ForceGraphMethods as ForceGraph3DMethods } from 'react-force-graph-3d'
import * as THREE from 'three'
import type { GraphData, GraphNode, GraphLink } from '@/types/memory'
import { getClusterColor } from '@/lib/cluster-colors'
import { useGraphAnimation, HOVER_LERP_SPEED, HOVER_SCALE, PROXIMITY_RADIUS, PROXIMITY_SCALE_MAX } from './useGraphAnimation'

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
//
// These values are in graph-space units. react-force-graph-2d applies the
// canvas transform before calling nodeCanvasObject, so 1 graph unit = 1px
// at globalScale=1. At high zoom (globalScale=10), a radius-28 node becomes
// 280 screen pixels — filling the entire canvas. Keeping radii small (4-16)
// ensures the node fits in its neighbourhood at any zoom level.
//
// For 3D, radius is halved further (*0.5) giving 2-8 units, which is
// appropriate for a scene where the default camera starts at z=1000.
// ---------------------------------------------------------------------------
const NODE_MIN_RADIUS = 4   // graph-space units; gives 4px at 1x zoom
const NODE_MAX_EXTRA = 12   // connectionCount * 2 capped — hub cap = 4+12=16

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

      const x = node.x ?? 0
      const y = node.y ?? 0

      // -- Proximity lens: scale up nodes near the cursor ---------------------
      let proximityMultiplier = 1.0
      const cursor = cursorGraphPos.current
      if (cursor && !prefersReducedMotion.current) {
        const dx = x - cursor.x
        const dy = y - cursor.y
        const distSq = dx * dx + dy * dy
        const radiusSq = PROXIMITY_RADIUS * PROXIMITY_RADIUS
        if (distSq < radiusSq) {
          const t = 1 - Math.sqrt(distSq) / PROXIMITY_RADIUS
          proximityMultiplier = 1 + (PROXIMITY_SCALE_MAX - 1) * t
          keepAlive.current = true
        }
      }

      // Cap displayRadius so no node ever exceeds MAX_NODE_SCREEN_PX screen pixels
      // regardless of zoom level. Without this cap, a hub node of radius 16 graph
      // units at globalScale=37 would render as 592 screen pixels — filling the
      // entire canvas with solid fill color. The cap converts to graph units by
      // dividing the pixel budget by globalScale: max graph-space radius at any
      // given zoom = MAX_NODE_SCREEN_PX / globalScale.
      const MAX_NODE_SCREEN_PX = 80
      const rawRadius = baseRadius * animMultiplier * proximityMultiplier
      const displayRadius = Math.min(rawRadius, MAX_NODE_SCREEN_PX / globalScale)

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
      // shadowBlur is in screen pixels (not graph units), so it must NOT be
      // multiplied by animMultiplier (which is a unitless scale factor) because
      // at animMultiplier=1.3 and globalScale=10 the glow was already tiny.
      // A fixed screen-pixel value of 12-18 looks consistent across all zoom levels.
      if (isHovered || isFocused) {
        ctx.shadowColor = isHovered ? clusterColor : '#00d9ff'
        ctx.shadowBlur = isHovered ? 18 : 12
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
          const fontSize = Math.max(10, 18 / globalScale)
          ctx.font = `${fontSize}px sans-serif`
          ctx.fillStyle = 'rgba(255,255,255,0.75)'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(label, x, y + displayRadius + 2 / globalScale)
        }
      }
    },
    [focusedNodeId, hoveredNodeId, nodeAnimState, cursorGraphPos, keepAlive, requestRefresh, prefersReducedMotion],
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

      // Build a stable id — by the time this callback fires, the library has
      // resolved source/target from strings to full node objects, so we read
      // .id from the resolved objects rather than from our domain cast.
      const linkId = `${sourceNode.id ?? ''}-${targetNode.id ?? ''}-${link.relation_type}`
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

  // Mutate existing Three.js meshes in place on hover change. Calling
  // graph3dRef.refresh() would reheat the d3 simulation and rebuild all
  // GPU geometry — instead we reach into node.__threeObj directly.
  useEffect(() => {
    if (viewMode !== '3d') return

    data.nodes.forEach((node) => {
      const threeObj = (node as unknown as { __threeObj?: THREE.Mesh }).__threeObj
      if (!threeObj || !(threeObj instanceof THREE.Mesh)) return

      const isHovered = node.id === hoveredNodeId
      const clusterColor = getClusterColor(node.cluster ?? 'unclustered')
      const baseRadius = nodeRadius(node.connectionCount ?? 0) * 0.5
      const targetRadius = isHovered ? baseRadius * 1.5 : baseRadius

      // Only replace geometry if the radius actually needs to change
      const currentRadius = (threeObj.geometry as THREE.SphereGeometry).parameters?.radius
      if (currentRadius !== targetRadius) {
        threeObj.geometry.dispose()
        threeObj.geometry = new THREE.SphereGeometry(targetRadius, 16, 12)
      }

      // Mutate material emissive in place — no material recreation needed
      const mat = threeObj.material as THREE.MeshLambertMaterial
      if (isHovered) {
        mat.emissive = new THREE.Color(clusterColor)
        mat.emissiveIntensity = 0.3
      } else {
        mat.emissive = new THREE.Color(0x000000)
        mat.emissiveIntensity = 0
      }
      mat.needsUpdate = true
    })
  }, [hoveredNodeId, viewMode, data.nodes])

  // ---------------------------------------------------------------------------
  // 3D node renderer — returns a THREE.Mesh for each node (initial state only).
  // Hover effects are handled by direct mesh mutation above.
  // ---------------------------------------------------------------------------
  const render3DNode = useCallback(
    (raw: RawNode): THREE.Object3D => {
      const node = asGraphNode(raw)
      const clusterColor = getClusterColor(node.cluster ?? 'unclustered')
      const radius = nodeRadius(node.connectionCount ?? 0) * 0.5
      const geometry = new THREE.SphereGeometry(radius, 16, 12)
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(clusterColor),
        transparent: true,
        opacity: node.is_stale ? 0.45 : 0.9,
        // Disable fog on node spheres so they render at full cluster color
        // regardless of camera distance. The camera starts at z=1000, which
        // puts nodes ~700-1000 units away — enough for FogExp2 to make them
        // near-black before the user zooms in. Edges/particles still receive
        // fog, preserving the depth-atmosphere effect on the scene geometry.
        fog: false,
      })
      return new THREE.Mesh(geometry, material)
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Fog setup — fires once after the 3D physics engine finishes its warmup.
  //
  // Node spheres set material.fog = false so they always render at full cluster
  // color (see render3DNode). The fog here therefore only affects edges, link
  // particles, and any other geometry that opts in — giving a subtle spatial-
  // depth cue without obscuring the nodes themselves.
  //
  // Density 0.0018 is a conservative value that keeps fog invisible at d<300
  // (close-up zoomed view) and noticeable only at d>600 (distant background),
  // which is appropriate for the edge/particle geometry depth cuing purpose.
  // ---------------------------------------------------------------------------
  const handle3DEngineStop = useCallback(() => {
    const graph = graph3dRef.current
    if (!graph) return
    const scene = graph.scene()
    if (scene && !scene.fog) {
      scene.fog = new THREE.FogExp2(0x0a0f19, 0.0018)
    }
  }, [])

  const handleLinkHover = useCallback(
    (raw: RawLink | null) => {
      if (!raw) {
        setHoveredLinkId(undefined)
        return
      }
      // Library resolves source/target to node objects — extract .id
      const sourceId = (raw.source as unknown as { id?: string }).id ?? ''
      const targetId = (raw.target as unknown as { id?: string }).id ?? ''
      const relationType = asGraphLink(raw).relation_type
      setHoveredLinkId(`${sourceId}-${targetId}-${relationType}`)
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
      // Drive re-render so proximity scaling updates as the cursor moves
      requestRefresh()
    },
    [graphRef, cursorGraphPos, viewMode, requestRefresh],
  )

  const handleMouseLeave = useCallback(() => {
    cursorGraphPos.current = null
    // One final refresh so nodes restore to normal size
    requestRefresh()
  }, [cursorGraphPos, requestRefresh])

  // ---------------------------------------------------------------------------
  // d3-force tuning — applied immediately on 2D mount, before warmupTicks run.
  //
  // Why custom forces are needed:
  // The default d3-force charge is -30 — far too weak for nodes with radii 4-16.
  // At -30, nodes with overlapping bounding circles won't be pushed apart,
  // producing the "bunched up" layout where edges are hidden behind nodes.
  //
  //   charge (forceManyBody): -200 gives strong enough repulsion for typical
  //     graphs of 20-200 nodes without disconnected components flying off-screen.
  //
  //   link distance: 60 keeps directly-connected nodes readable without
  //     stretching long chains across the viewport.
  //
  // These are set in a useEffect that runs after mount (when graphRef is
  // populated) but BEFORE the simulation has run its warmupTicks. That means
  // the forces are in effect for the entire initial layout — no reheat needed,
  // and no risk of nodes flying off-screen after the camera has already settled.
  //
  // The effect re-runs whenever data or viewMode changes so a new graph load
  // always picks up the tuned forces.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (viewMode !== '2d') return
    // graphRef is populated synchronously by React after ForceGraph2D renders,
    // but we schedule via setTimeout(0) to ensure the library's d3 simulation
    // has been initialised (it sets up forces inside its own useEffect).
    const timer = setTimeout(() => {
      const graph = graphRef.current
      if (!graph) return

      const charge = graph.d3Force('charge') as ({ strength(s: number): unknown }) | null
      if (charge && typeof charge.strength === 'function') {
        charge.strength(-200)
      }

      const link = graph.d3Force('link') as ({ distance(d: number): unknown }) | null
      if (link && typeof link.distance === 'function') {
        link.distance(60)
      }

      // No d3ReheatSimulation() call here — the forces are set before warmupTicks
      // fire (setTimeout(0) runs before the library's internal tick scheduler
      // has a chance to start the initial animation loop), so they take effect
      // from tick 1. Calling reheat after a stable layout would fling nodes to
      // new positions while the camera stays fixed — producing a blank canvas.
    }, 0)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, viewMode])

  // No-op onEngineStop handler — kept for the 2D component prop; the actual
  // force tuning now happens in the effect above, not here.
  const handle2DEngineStop = useCallback(() => {
    // intentionally empty — force tuning is in the useEffect above
  }, [])

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
          onEngineStop={handle2DEngineStop}
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
