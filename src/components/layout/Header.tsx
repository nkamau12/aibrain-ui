import { useLocation } from 'react-router-dom'

/** Maps route pathnames to human-readable page titles */
const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/search': 'Search',
  '/tags': 'Tags',
}

function resolveTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/memory/')) return 'Memory Detail'
  return 'aibrain-ui'
}

interface HeaderProps {
  /** Called by Shell to toggle the mobile sidebar */
  onMenuToggle: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const location = useLocation()
  const title = resolveTitle(location.pathname)

  return (
    <header className="h-14 shrink-0 border-b border-border flex items-center gap-4 px-4 bg-surface/60 backdrop-blur-sm">
      {/* Mobile hamburger — hidden on md+ where the sidebar is always visible */}
      <button
        type="button"
        aria-label="Toggle navigation"
        className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px] shrink-0 rounded focus-visible:outline-2 focus-visible:outline-brand-cyan-500 focus-visible:outline-offset-2"
        onClick={onMenuToggle}
      >
        <span className="block w-5 h-0.5 bg-foreground rounded-full" />
        <span className="block w-5 h-0.5 bg-foreground rounded-full" />
        <span className="block w-5 h-0.5 bg-foreground rounded-full" />
      </button>

      <h2 className="text-base font-semibold text-text-heading">{title}</h2>
    </header>
  )
}
