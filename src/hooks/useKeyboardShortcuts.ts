import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * Returns true when the keyboard event originates from a focusable text entry
 * element — input, textarea, select, or any element with contenteditable.
 *
 * We must skip shortcuts in these cases so they don't interfere with normal
 * typing.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  )
}

/**
 * Mount this hook once at the application shell level to register global
 * keyboard shortcuts.
 *
 * Active shortcuts:
 *   `/`      — Focus the search input (navigates to /search if not already there)
 *   `Escape` — Close the nearest open modal / dialog (dispatches a custom event
 *               that modal components can listen to, and also calls the native
 *               `dialog.close()` on any open <dialog> elements)
 *
 * All shortcuts are silenced when the event target is a text-input element so
 * they never interfere with normal typing.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Never fire when the user is typing in a form field
      if (isTypingTarget(event.target)) return

      // Ignore modified key combos (Ctrl, Alt, Meta) to avoid clobbering OS
      // and browser shortcuts. Shift alone is fine (e.g. `?` requires Shift).
      if (event.ctrlKey || event.altKey || event.metaKey) return

      switch (event.key) {
        case '/': {
          // Prevent the browser's quick-find-bar from opening
          event.preventDefault()

          if (location.pathname === '/search') {
            // Already on search — just focus the input that SearchBar renders
            const input = document.querySelector<HTMLInputElement>(
              'input[role="searchbox"]',
            )
            input?.focus()
          } else {
            // Navigate to search; SearchBar auto-focuses on mount
            navigate('/search')
          }
          break
        }

        case 'Escape': {
          // Dispatch a synthetic event that in-app modals/dialogs can listen
          // to for a clean close. This keeps the hook decoupled from any
          // specific modal implementation.
          window.dispatchEvent(new CustomEvent('app:close-modal'))

          // Also close any native <dialog> elements that are currently open
          document
            .querySelectorAll<HTMLDialogElement>('dialog[open]')
            .forEach((dialog) => dialog.close())

          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, location.pathname])
}
