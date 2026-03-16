import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

/**
 * Root layout for all authenticated routes.
 *
 * Layout structure (desktop):
 *   ┌──────────┬──────────────────────┐
 *   │          │  Header (h-14)       │
 *   │ Sidebar  ├──────────────────────┤
 *   │  (w-56)  │  <Outlet />          │
 *   │          │  (scrollable)        │
 *   └──────────┴──────────────────────┘
 *
 * On mobile the sidebar overlays the content and is toggled via the
 * hamburger button in the Header.
 */
export default function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main column: header + scrollable page content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
