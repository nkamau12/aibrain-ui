import type { BatchDeleteState } from '@/hooks/useDeleteMemories'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SelectedMemory {
  id: string
  summary: string
}

interface BatchDeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMemories: SelectedMemory[]
  deleteState: BatchDeleteState
  onConfirm: () => void
  onRetry: () => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_PREVIEW_ITEMS = 3
const SUMMARY_MAX_CHARS = 80

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
}

// ---------------------------------------------------------------------------
// Sub-views — each dialog state is its own focused component so the parent
// stays clean and each state is easy to read and test in isolation.
// ---------------------------------------------------------------------------

interface IdleViewProps {
  memories: SelectedMemory[]
  onCancel: () => void
  onConfirm: () => void
}

function IdleView({ memories, onCancel, onConfirm }: IdleViewProps) {
  const count = memories.length
  const previewItems = memories.slice(0, MAX_PREVIEW_ITEMS)
  const overflow = count - MAX_PREVIEW_ITEMS

  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete {count} {count === 1 ? 'memory' : 'memories'}?</DialogTitle>
        <DialogDescription>
          This action cannot be undone. The following{' '}
          {count === 1 ? 'memory' : 'memories'} will be permanently deleted:
        </DialogDescription>
      </DialogHeader>

      <ul className="flex flex-col gap-1.5">
        {previewItems.map((memory) => (
          <li
            key={memory.id}
            className="text-sm text-text-body bg-surface-2/50 rounded px-3 py-2 border border-border/40"
          >
            {truncate(memory.summary, SUMMARY_MAX_CHARS)}
          </li>
        ))}
        {overflow > 0 && (
          <li className="text-sm text-text-muted px-3 py-1">
            …and {overflow} more
          </li>
        )}
      </ul>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="ghost"
          className="bg-brand-rose-600 hover:bg-brand-rose-500 text-white border-transparent"
          onClick={onConfirm}
        >
          Delete {count}
        </Button>
      </DialogFooter>
    </>
  )
}

interface DeletingViewProps {
  progress: number
  total: number
}

function DeletingView({ progress, total }: DeletingViewProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Deleting memories…</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-2 py-2">
        <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
          <div
            className="h-full bg-brand-cyan-500 transition-all duration-300 ease-out"
            style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
          />
        </div>
        <p className="text-sm text-text-muted text-center">
          {progress} of {total}
        </p>
      </div>
    </>
  )
}

interface DoneViewProps {
  count: number
  onClose: () => void
}

function DoneView({ count, onClose }: DoneViewProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Deleted successfully</DialogTitle>
        <DialogDescription>
          {count} {count === 1 ? 'memory has' : 'memories have'} been permanently deleted.
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button variant="default" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  )
}

interface ErrorViewProps {
  deleteState: BatchDeleteState
  summaryById: Map<string, string>
  onClose: () => void
  onRetry: () => void
}

function ErrorView({ deleteState, summaryById, onClose, onRetry }: ErrorViewProps) {
  const { failures, deletedIds } = deleteState
  const deletedCount = deletedIds.length
  const failCount = failures.length

  return (
    <>
      <DialogHeader>
        <DialogTitle>Deletion partially failed</DialogTitle>
        <DialogDescription>
          {deletedCount} deleted, {failCount} failed.
        </DialogDescription>
      </DialogHeader>

      {failures.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {failures.map(({ id, error }) => {
            const summary = summaryById.get(id)
            return (
              <li
                key={id}
                className="text-sm text-text-body bg-surface-2/50 rounded px-3 py-2 border border-border/40"
              >
                <span className="block">
                  {summary ? truncate(summary, SUMMARY_MAX_CHARS) : id}
                </span>
                <span className="block text-xs text-brand-rose-400 mt-0.5">{error}</span>
              </li>
            )
          })}
        </ul>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button variant="default" onClick={onRetry}>
          Retry failed ({failCount})
        </Button>
      </DialogFooter>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Confirmation dialog for batch memory deletion.
 *
 * Renders four distinct states driven by `deleteState.status`:
 *   - idle     → confirmation prompt with memory preview list
 *   - deleting → progress bar (dialog is non-dismissible)
 *   - done     → success message with a single Close button
 *   - error    → partial failure summary with retry option
 *
 * The parent is responsible for wiring onConfirm, onRetry, and onClose to
 * the appropriate methods on useDeleteMemories.
 */
export function BatchDeleteConfirmDialog({
  open,
  onOpenChange,
  selectedMemories,
  deleteState,
  onConfirm,
  onRetry,
  onClose,
}: BatchDeleteConfirmDialogProps) {
  const { status } = deleteState
  const isDeleting = status === 'deleting'

  // Build a lookup map once so ErrorView can resolve summaries by ID without
  // an O(n²) search inside the render loop.
  const summaryById = new Map(selectedMemories.map((m) => [m.id, m.summary]))

  // Prevent accidental dismissal while a deletion is in flight. For all other
  // states we delegate directly to the caller's handler.
  function handleOpenChange(nextOpen: boolean) {
    if (isDeleting) return
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isDeleting}
        className="sm:max-w-md"
      >
        {status === 'idle' && (
          <IdleView
            memories={selectedMemories}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
          />
        )}

        {status === 'deleting' && (
          <DeletingView
            progress={deleteState.progress}
            total={deleteState.total}
          />
        )}

        {status === 'done' && (
          <DoneView
            count={deleteState.deletedIds.length}
            onClose={onClose}
          />
        )}

        {status === 'error' && (
          <ErrorView
            deleteState={deleteState}
            summaryById={summaryById}
            onClose={onClose}
            onRetry={onRetry}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
