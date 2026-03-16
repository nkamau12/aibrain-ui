import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// BatchActionBar — fixed bottom toolbar shown during bulk-selection mode
//
// Appears with a slide-up animation whenever selectedCount > 0.
// The delete button is intentionally disabled at N=0 to guard against
// accidental invocations before the user has selected any items.
// ---------------------------------------------------------------------------

export interface BatchActionBarProps {
  /** Number of currently selected items. */
  selectedCount: number
  /** Total number of items on the current page (used for "Select all" label). */
  pageCount: number
  /** Select every item on the current page. */
  onSelectAll: () => void
  /** Clear the current selection. */
  onDeselectAll: () => void
  /** Initiate deletion of all selected items. */
  onDelete: () => void
  /** Exit batch-selection mode without deleting. */
  onCancel: () => void
}

export function BatchActionBar({
  selectedCount,
  pageCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onCancel,
}: BatchActionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Batch actions"
      className="
        fixed bottom-0 left-0 right-0 z-50
        bg-surface-2/95 backdrop-blur-sm border-t border-border shadow-lg shadow-black/30
        animate-in slide-in-from-bottom duration-200
      "
    >
      <div
        className="
          mx-auto max-w-5xl px-4 sm:px-6 py-3
          flex flex-col gap-2
          sm:flex-row sm:items-center sm:justify-between
        "
      >
        {/* Selection count — top row on mobile, left side on sm+ */}
        <span
          aria-live="polite"
          aria-atomic="true"
          className="text-text-body text-sm font-medium"
        >
          {selectedCount} selected
        </span>

        {/* Action buttons — wrapping row on mobile, right side on sm+ */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            Select all ({pageCount})
          </Button>

          <Button variant="ghost" size="sm" onClick={onDeselectAll}>
            Deselect all
          </Button>

          <Button
            size="sm"
            disabled={selectedCount === 0}
            aria-label={`Delete ${selectedCount} selected memories`}
            onClick={onDelete}
            className="bg-brand-rose-600 hover:bg-brand-rose-500 text-white border-transparent"
          >
            Delete {selectedCount}
          </Button>

          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
