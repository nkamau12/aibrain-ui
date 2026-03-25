import { useRef, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { ForceGraphMethods } from 'react-force-graph-2d'

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------
export const HOVER_LERP_SPEED = 0.18
export const PROXIMITY_RADIUS = 80  // graph-space units
export const PROXIMITY_SCALE_MAX = 1.25

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------
export interface GraphAnimationState {
  /** Animated radius multiplier per node ID (default 1.0 when absent) */
  nodeAnimState: MutableRefObject<Map<string, number>>
  /** Cursor position in graph-space coordinates, null when outside canvas */
  cursorGraphPos: MutableRefObject<{ x: number; y: number } | null>
  /** Start (or continue) the rAF loop — call whenever animation state changes */
  requestRefresh: () => void
  /** True when the user has opted into reduced motion */
  prefersReducedMotion: MutableRefObject<boolean>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useGraphAnimation(
  graphRef: MutableRefObject<ForceGraphMethods | undefined>,
): GraphAnimationState {
  const nodeAnimState = useRef<Map<string, number>>(new Map())
  const cursorGraphPos = useRef<{ x: number; y: number } | null>(null)
  const rafId = useRef<number | null>(null)
  const prefersReducedMotion = useRef<boolean>(false)

  // Sync prefersReducedMotion from the OS setting and keep it live
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.current = mq.matches

    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Cancel any in-flight rAF when the component unmounts
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
    }
  }, [])

  const requestRefresh = () => {
    // Already running — nothing to do
    if (rafId.current !== null) return

    const tick = () => {
      const graph = graphRef.current
      if (graph) graph.refresh()

      // Check whether all animated values have converged to their targets.
      // If nothing is still animating, stop the loop.
      let stillAnimating = false
      nodeAnimState.current.forEach((value) => {
        // Values very close to 1.0 (resting) or a stable target are fine;
        // the callers lerp toward 1.0 or another target — we just need to keep
        // ticking while any value differs meaningfully from its resting state.
        // A tolerance of 0.005 is sub-pixel at any practical node size.
        if (Math.abs(value - 1.0) > 0.005) stillAnimating = true
      })

      if (stillAnimating) {
        rafId.current = requestAnimationFrame(tick)
      } else {
        rafId.current = null
      }
    }

    rafId.current = requestAnimationFrame(tick)
  }

  return { nodeAnimState, cursorGraphPos, requestRefresh, prefersReducedMotion }
}
