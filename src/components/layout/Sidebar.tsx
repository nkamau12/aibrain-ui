import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { Brain, LayoutDashboard, Network, Search, Tags, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/graph', icon: Network, label: 'Brain Graph' },
  { to: '/tags', icon: Tags, label: 'Tags' },
]

interface SidebarProps {
  /** Controls mobile overlay visibility — managed by Shell */
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Focus the close button when sidebar opens on mobile & close on Escape
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isOpen])

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      <aside
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        className={cn(
          // Base: fixed on mobile, relative in the flex row on desktop
          'fixed inset-y-0 left-0 z-30 flex flex-col w-56 bg-sidebar border-r border-border',
          // Mobile: slide in/out via translate
          'transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible, no translate tricks
          'md:relative md:translate-x-0 md:z-auto',
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between h-14 px-4 shrink-0 border-b border-border">
          <NavLink to="/" onClick={onClose} className="flex items-center gap-2" aria-label="aiBrain home">
            <Brain className="w-5 h-5 text-brand-cyan-500" aria-hidden />
            <span className="font-semibold text-text-heading tracking-tight">
              aiBrain
            </span>
          </NavLink>

          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close navigation"
            className="md:hidden w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-brand-cyan-500 focus-visible:outline-offset-2"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main navigation">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? // Active state: cyan accent text + subtle cyan-tinted background
                          'text-brand-cyan-400 bg-brand-cyan-500/10'
                        : 'text-text-body hover:text-text-heading hover:bg-surface-2',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          'w-4 h-4 shrink-0',
                          isActive ? 'text-brand-cyan-400' : 'text-text-muted',
                        )}
                      />
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
