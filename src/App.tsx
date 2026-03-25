import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Shell from '@/components/layout/Shell'
import { ErrorBoundary } from '@/components/ErrorBoundary'

/**
 * Lazy-loaded page components.
 *
 * Code-splitting at the route level keeps the initial JS bundle small — each
 * page chunk is only fetched when the user navigates to that route for the
 * first time. Subsequent visits are served from the module cache.
 */
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Search = lazy(() => import('@/pages/Search'))
const Tags = lazy(() => import('@/pages/Tags'))
const MemoryDetail = lazy(() => import('@/pages/MemoryDetail'))
const BrainGraph = lazy(() => import('@/pages/BrainGraph'))

/**
 * Minimal full-page loading indicator shown by Suspense while a page chunk is
 * being fetched. Intentionally lightweight — it should appear and disappear
 * within a few hundred milliseconds on any reasonable connection.
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div
        className="w-8 h-8 rounded-full border-2 border-brand-cyan-500/30 border-t-brand-cyan-500 animate-spin"
        role="status"
        aria-label="Loading page…"
      />
    </div>
  )
}

/**
 * Application root — defines the router and all top-level route mappings.
 *
 * Route tree:
 *   /                → Dashboard
 *   /search          → Search
 *   /tags            → Tags
 *   /graph           → BrainGraph
 *   /memory/:id      → MemoryDetail
 *
 * All routes are wrapped in Shell, which provides the sidebar and header.
 * Shell renders the matched child via <Outlet />.
 *
 * Each page is individually wrapped in an ErrorBoundary so a render crash in
 * one page cannot cascade and take down the shell or other pages.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route
            index
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Dashboard />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="search"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Search />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="tags"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Tags />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="graph"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <BrainGraph />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="memory/:id"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <MemoryDetail />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
