import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/components/ui/sonner'

/*
 * Apply the 'dark' class to <html> so shadcn/ui's @custom-variant dark
 * selector activates all dark-mode component tokens globally.
 * aibrain-ui has no light mode — this is always set.
 */
document.documentElement.classList.add('dark')

/*
 * Single QueryClient for the entire app lifetime.
 * Defaults are intentionally conservative:
 * - staleTime 0 — always re-fetch on mount; individual hooks can override
 * - retry 1 — one automatic retry before surfacing an error to the UI
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Toast provider — position and theme configured inside Toaster */}
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
