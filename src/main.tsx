import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/components/ui/sonner'

/*
 * Apply the 'dark' class to <html> so shadcn/ui's @custom-variant dark
 * selector activates all dark-mode component tokens globally.
 * aibrain-ui has no light mode — this is always set.
 */
document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Toast provider — position and theme configured inside Toaster */}
    <Toaster />
  </StrictMode>,
)
