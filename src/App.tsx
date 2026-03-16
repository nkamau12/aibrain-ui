import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Shell from '@/components/layout/Shell'
import Dashboard from '@/pages/Dashboard'
import Search from '@/pages/Search'
import Tags from '@/pages/Tags'
import MemoryDetail from '@/pages/MemoryDetail'

/**
 * Application root — defines the router and all top-level route mappings.
 *
 * Route tree:
 *   /                → Dashboard
 *   /search          → Search
 *   /tags            → Tags
 *   /memory/:id      → MemoryDetail
 *
 * All routes are wrapped in Shell, which provides the sidebar and header.
 * Shell renders the matched child via <Outlet />.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="search" element={<Search />} />
          <Route path="tags" element={<Tags />} />
          <Route path="memory/:id" element={<MemoryDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
