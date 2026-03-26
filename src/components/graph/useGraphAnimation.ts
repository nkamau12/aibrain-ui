import { useRef, useEffect, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { ForceGraphMethods } from 'react-force-graph-2d'

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------
export const HOVER_LERP_SPEED = 0.18
export const HOVER_SCALE = 1.3        // hovered node radius multiplier
export const PROXIMITY_RADIUS = 80   // graph-space units
export const PROXIMITY_SCALE_MAX = 1.25

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------
export interface GraphAnimationState {
  /** Animated radius multiplier per node ID (default 1.0 when absent) */
  nodeAnimState: MutableRefObject<Map<string, number>>
  /** Cursor position in graph-space coordinates, null when outside canvas */
  cursorGraphPos: MutableRefObject<{ x: number; y: number } | null>
  /**
   * Start (or continue) the rAF loop.
   *
   * The loop ticks as long as `keepAlive.current` is true. Callers (renderNode)
   * set `keepAlive.current = true` whenever a lerp step is still in progress,
   * and the loop self-stops once a full tick passes without a keep-alive signal.
   */
  requestRefresh: () => void
  /** Set to true inside renderNode whenever a lerp step is non-trivial */
  keepAlive: MutableRefObject<boolean>
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
  const keepAlive = useRef<boolean>(false)
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

  // Wrapped in useCallback so the reference is stable across renders — all
  // dependencies are refs, so the dep array is empty.
  //
  // react-force-graph-2d does not expose a `refresh()` method. To force
  // a canvas repaint we restart the library's internal animation loop by
  // calling pauseAnimation() + resumeAnimation(). This re-enters
  // `_animationCycle` which re-renders the canvas without reheating the
  // d3 simulation (no node movement).
  const requestRefresh = useCallback(() => {
    // Already running — nothing to do
    if (rafId.current !== null) return

    const tick = () => {
      const graph = graphRef.current
      if (graph) {
        graph.pauseAnimation()
        graph.resumeAnimation()
      }

      // renderNode sets keepAlive = true whenever a lerp step is in flight.
      // If it stayed false after the refresh above, all animations have settled.
      if (keepAlive.current) {
        keepAlive.current = false  // reset for the next tick
        rafId.current = requestAnimationFrame(tick)
      } else {
        rafId.current = null
      }
    }

    rafId.current = requestAnimationFrame(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { nodeAnimState, cursorGraphPos, requestRefresh, keepAlive, prefersReducedMotion }
}
