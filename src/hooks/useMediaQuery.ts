import { useState, useEffect } from 'react'

/**
 * Returns true when the given CSS media query matches, and keeps the value
 * in sync as the viewport changes. Initialises synchronously on the first
 * render so there is no flash of mismatched state (SSR-safe: defaults to
 * false when `window` is unavailable).
 */
export function useMediaQuery(query: string): boolean {
  const getMatch = () =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false

  const [matches, setMatches] = useState(getMatch)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
