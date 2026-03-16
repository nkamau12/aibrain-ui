import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

interface SearchBarProps {
  /** Initial value — used to restore state from URL on mount */
  initialValue?: string
  onQueryChange: (query: string) => void
  placeholder?: string
}

const DEBOUNCE_MS = 300

/**
 * Full-width search input with a 300ms debounce. Emits the debounced value
 * via `onQueryChange` so the parent can trigger a network request without
 * firing on every keystroke. A clear button appears when the field is non-empty.
 *
 * Auto-focuses on mount so users can start typing immediately on page load.
 */
export function SearchBar({
  initialValue = '',
  onQueryChange,
  placeholder = 'Search your memories…',
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // When initialValue changes (URL restore), sync the input and emit immediately
  useEffect(() => {
    setInputValue(initialValue)
  }, [initialValue])

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    setInputValue(value)

    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      onQueryChange(value)
    }, DEBOUNCE_MS)
  }

  function handleClear() {
    setInputValue('')
    onQueryChange('')
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current)
    }
    inputRef.current?.focus()
  }

  // Clean up pending timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  return (
    <div className="relative w-full">
      {/* Search icon — decorative, points inward */}
      <Search
        className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-text-muted pointer-events-none"
        aria-hidden
      />

      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        aria-label="Search memories"
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="
          w-full h-11 rounded-lg
          bg-surface border border-border/60
          pl-10 pr-10 text-sm text-text-body
          placeholder:text-text-muted
          transition-colors duration-150
          hover:border-border
          focus:outline-none focus:border-brand-cyan-500/60 focus:ring-1 focus:ring-brand-cyan-500/30
        "
      />

      {/* Clear button — only visible when there is text */}
      {inputValue.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="
            absolute right-3 top-1/2 -translate-y-1/2
            size-5 flex items-center justify-center rounded
            text-text-muted
            hover:text-text-body
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            transition-colors duration-150
          "
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
