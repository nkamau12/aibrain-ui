# Batch Delete Feature — Implementation Plan

## Summary

This plan breaks the batch delete feature into **4 sequential phases** containing **7 tasks**. Tasks within each phase can be executed in parallel by different developers without file conflicts. The dependency chain is:

1. **Phase 1** — Foundation (extract shared component, build hook) — 2 parallel tasks
2. **Phase 2** — New UI components (BatchActionBar, BatchDeleteConfirmDialog) — 2 parallel tasks
3. **Phase 3** — Selection logic in SearchResultCard — 1 task (depends on Phase 1 extraction)
4. **Phase 4** — Integration wiring in Search.tsx and SearchResults.tsx — 1 task (depends on all above)

No two parallel tasks touch the same file.

---

## Phase 1 — Foundation (parallel)

These two tasks have zero file overlap and can be assigned to two developers simultaneously.

---

### TASK-1: Extract SearchResultCard to its own file

- [ ] **Complete**
- **Priority**: P1
- **Domain**: Frontend — component extraction (refactor)
- **Estimated effort**: S
- **Branch**: `feature/batch-delete-1-extract-card`
- **Files affected**:
  - `src/components/search/SearchResultCard.tsx` (NEW)
  - `src/components/search/SearchResults.tsx` (MODIFY — remove inlined card, add import)

#### Description

`SearchResultCard`, `HighlightedText`, and the helper functions (`shortenProjectPath`, `formatScore`, `scoreColorClass`) are currently defined inline inside `SearchResults.tsx` (lines 13-176). Extract them into a dedicated file so that Phase 3 can add selection props without creating a merge conflict with Phase 4's changes to `SearchResults.tsx`.

#### What to do

1. Create `src/components/search/SearchResultCard.tsx` containing:
   - `SearchResultCard` component (exported, named export)
   - `HighlightedText` component (exported — reused in SearchResults header potentially)
   - `shortenProjectPath`, `formatScore`, `scoreColorClass` helper functions (not exported — internal)
   - The `SearchResultCardProps` interface (exported)
2. In `SearchResults.tsx`:
   - Remove lines 13-176 (the card, helpers, and HighlightedText)
   - Add `import { SearchResultCard } from './SearchResultCard'`
   - All existing behavior must remain identical

#### Acceptance criteria

- [ ] `SearchResultCard.tsx` exists and exports `SearchResultCard` and `SearchResultCardProps`
- [ ] `SearchResults.tsx` imports from `./SearchResultCard` — no inline card definition remains
- [ ] All search result rendering behaves identically (card layout, score badges, tag pills, click-to-navigate, keyboard nav, highlighted text)
- [ ] `npm run build` passes with zero errors
- [ ] No other files are modified

#### Dependencies

- None — this is a pure refactor

#### Parallelization notes

Safe to run concurrently with TASK-2. No file overlap.

#### Verification

```bash
npm run build
# Manual: navigate to /search, run a query, verify cards render identically
# Manual: click a card, verify navigation to /memory/:id works
# Manual: verify highlighted text still bolds query terms
```

---

### TASK-2: Create useDeleteMemories hook (batch delete with progress)

- [ ] **Complete**
- **Priority**: P1
- **Domain**: Frontend — data layer (TanStack Query hook)
- **Estimated effort**: M
- **Branch**: `feature/batch-delete-2-hook`
- **Files affected**:
  - `src/hooks/useDeleteMemories.ts` (NEW)

#### Description

Create a new hook that deletes multiple memories sequentially, tracking progress and handling partial failures. This hook will be consumed by `BatchDeleteConfirmDialog` in Phase 2 and wired up in Phase 4.

**Important**: This is a NEW file, not a modification to `useMemories.ts`. This avoids conflicts with any other work touching the existing hooks file.

#### What to do

1. Create `src/hooks/useDeleteMemories.ts` with the following API:

```typescript
interface BatchDeleteState {
  /** 'idle' | 'deleting' | 'done' | 'error' */
  status: 'idle' | 'deleting' | 'done' | 'error'
  /** Number of IDs successfully deleted so far */
  progress: number
  /** Total number of IDs requested for deletion */
  total: number
  /** IDs that failed to delete, with their error messages */
  failures: Array<{ id: string; error: string }>
  /** Summaries of successfully deleted memories (for toast/confirmation) */
  deletedIds: string[]
}

interface UseDeleteMemoriesReturn {
  /** Current state of the batch operation */
  state: BatchDeleteState
  /** Kick off sequential deletion of the given IDs */
  deleteMemories: (ids: string[]) => Promise<void>
  /** Retry only the failed IDs from the last batch */
  retryFailed: () => Promise<void>
  /** Reset state back to idle */
  reset: () => void
}

export function useDeleteMemories(): UseDeleteMemoriesReturn
```

2. Implementation details:
   - Use `useState` for state management (not `useMutation` — the sequential loop doesn't fit the single-request mutation model)
   - Import `apiFetch` from `@/lib/api` and `useQueryClient` from `@tanstack/react-query`
   - For each ID, call `apiFetch<void>(\`/api/memories/\${id}\`, { method: 'DELETE' })`
   - Increment `progress` after each call (success or fail)
   - Catch per-ID errors; collect them in `failures` array — do NOT abort on first failure
   - On completion (all IDs attempted): if failures is empty, set status to `'done'`; otherwise `'error'`
   - Optimistic cache removal: before starting the loop, remove all IDs from `['memories', 'recent']` and `['memories', 'search']` caches (same pattern as `useDeleteMemory` in `useMemories.ts`)
   - On full success: invalidate both query families and remove individual detail caches
   - On partial failure: invalidate caches (so successfully deleted ones disappear, failed ones reappear on refetch)
   - `retryFailed()`: re-runs `deleteMemories` with only the IDs in `failures`
   - `reset()`: returns state to idle defaults
   - Use `useRef` to store an abort flag so callers could potentially cancel (future-proofing)

#### Acceptance criteria

- [ ] `src/hooks/useDeleteMemories.ts` exists with the interface above
- [ ] Sequential deletion with per-ID error handling — never throws, never aborts on single failure
- [ ] Progress tracking: `state.progress` increments after each ID is attempted
- [ ] Optimistic cache removal of all target IDs before loop starts
- [ ] Cache invalidation on completion (both success and partial failure)
- [ ] `retryFailed()` retries only previously failed IDs
- [ ] `reset()` returns to idle state
- [ ] `npm run build` passes — no unused imports, no type errors
- [ ] Unit-testable: all API calls go through `apiFetch`, all cache ops through `queryClient`

#### Dependencies

- None — new file, references only existing `@/lib/api` and `@tanstack/react-query`

#### Parallelization notes

Safe to run concurrently with TASK-1. Creates a new file; does not touch `useMemories.ts`.

#### Verification

```bash
npm run build
# The hook isn't wired to UI yet — verify via build only at this stage
# Optionally: write a quick test component that imports and calls the hook
```

---

## Phase 2 — New UI Components (parallel)

Both tasks create brand-new files with no overlap. They depend on Phase 1 only insofar as the hook (TASK-2) should exist, but the Dialog component can be built with a mock/stub of the hook interface.

---

### TASK-3: Create BatchActionBar component

- [ ] **Complete**
- **Priority**: P1
- **Domain**: Frontend — UI component
- **Estimated effort**: S
- **Branch**: `feature/batch-delete-3-action-bar`
- **Files affected**:
  - `src/components/search/BatchActionBar.tsx` (NEW)

#### Description

A fixed-position bottom bar that appears when one or more items are selected. Shows the selection count and provides bulk actions: Select all, Deselect all, Delete selected, Cancel selection mode.

#### What to do

1. Create `src/components/search/BatchActionBar.tsx`:

```typescript
interface BatchActionBarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  onDelete: () => void
  onCancel: () => void
}
```

2. Layout:
   - Fixed to viewport bottom: `fixed bottom-0 left-0 right-0 z-50`
   - Dark surface background: `bg-surface-2 border-t border-border`
   - Inner content max-width matches page layout, centered with `mx-auto max-w-7xl px-6`
   - Height: `py-3` for comfortable touch targets
   - Slide-up animation: use CSS transition (`translate-y-0` when visible, `translate-y-full` when hidden). Accept an `isVisible` prop or let parent control mount/unmount — prefer mount/unmount with CSS `animate-in` for simplicity
   - Left side: "{N} selected" text in `text-text-body text-sm font-medium`
   - Right side: row of buttons with `gap-2`
     - "Select all (M)" — secondary/ghost style, shows total page count
     - "Deselect all" — secondary/ghost style
     - "Delete N" — destructive style: `bg-brand-rose-600 hover:bg-brand-rose-700 text-white`
     - "Cancel" — ghost style
   - Use `Button` from `@/components/ui/button` for all buttons

3. Animation approach:
   - Wrap in a container with `transition-transform duration-200 ease-out`
   - When `selectedCount > 0`, render the bar. Parent controls visibility.
   - Add `animate-in slide-in-from-bottom` class (Tailwind CSS animation) on mount

4. Accessibility:
   - `role="toolbar"` and `aria-label="Batch actions"` on the container
   - Delete button should have `aria-label="Delete N selected memories"` with actual count

#### Acceptance criteria

- [ ] `BatchActionBar.tsx` exists with the props interface above
- [ ] Fixed bottom positioning with proper z-index
- [ ] All four action buttons render with correct labels and styles
- [ ] Delete button uses destructive (rose) styling
- [ ] Selection count displays correctly
- [ ] Uses `Button` from shadcn/ui — consistent with rest of app
- [ ] Accessible: toolbar role, labeled buttons
- [ ] `npm run build` passes

#### Dependencies

- None — standalone presentational component, callbacks are injected via props

#### Parallelization notes

Safe to run concurrently with TASK-4. No file overlap.

#### Verification

```bash
npm run build
# Manual: temporarily render in Search.tsx with dummy props to visually verify
# Verify fixed positioning, button styles, responsive layout
```

---

### TASK-4: Create BatchDeleteConfirmDialog component

- [ ] **Complete**
- **Priority**: P1
- **Domain**: Frontend — UI component
- **Estimated effort**: M
- **Branch**: `feature/batch-delete-4-confirm-dialog`
- **Files affected**:
  - `src/components/search/BatchDeleteConfirmDialog.tsx` (NEW)

#### Description

A confirmation dialog that appears when the user clicks "Delete N" in the BatchActionBar. Shows a preview of what will be deleted, a progress bar during deletion, and handles partial failure with a retry option.

#### What to do

1. Create `src/components/search/BatchDeleteConfirmDialog.tsx`:

```typescript
interface BatchDeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Memories selected for deletion — used to show preview summaries */
  selectedMemories: Array<{ id: string; summary: string }>
  /** The batch delete hook state + actions */
  deleteState: BatchDeleteState
  onConfirm: () => void
  onRetry: () => void
  onClose: () => void
}
```

2. Dialog states:
   - **Confirm** (`deleteState.status === 'idle'`):
     - Title: "Delete {N} memories?"
     - Body: "This action cannot be undone. The following memories will be permanently deleted:"
     - Show up to 3 memory summaries as a bulleted list (truncated to ~80 chars each)
     - If more than 3: show "...and {N-3} more"
     - Footer: "Cancel" button (ghost) + "Delete {N}" button (destructive rose)
   - **Deleting** (`deleteState.status === 'deleting'`):
     - Title: "Deleting memories..."
     - Progress bar: `{progress}/{total}` with a visual bar using Tailwind width percentage
     - Progress bar color: `bg-brand-cyan-500`
     - Cancel/close buttons disabled during deletion
     - No footer buttons — just the progress indicator
   - **Done** (`deleteState.status === 'done'`):
     - Title: "Deleted successfully"
     - Body: "{N} memories have been permanently deleted."
     - Footer: single "Done" button that closes dialog and exits selection mode
   - **Partial failure** (`deleteState.status === 'error'`):
     - Title: "Deletion partially failed"
     - Body: "{successCount} deleted, {failCount} failed"
     - List failed memory IDs (or summaries if available)
     - Footer: "Retry failed ({failCount})" button (primary) + "Close" button (ghost)

3. Use the shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` components from `@/components/ui/dialog`

4. Progress bar: simple div-in-div approach:
   ```
   <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
     <div className="h-full bg-brand-cyan-500 transition-all duration-300"
          style={{ width: `${(progress/total) * 100}%` }} />
   </div>
   ```

#### Acceptance criteria

- [ ] `BatchDeleteConfirmDialog.tsx` exists with the props interface above
- [ ] All 4 states render correctly: confirm, deleting, done, partial failure
- [ ] Up to 3 memory summaries shown in confirm state, with "+N more" overflow
- [ ] Progress bar updates during deletion
- [ ] Retry button only appears on partial failure
- [ ] Dialog cannot be dismissed during active deletion (close button disabled, escape blocked)
- [ ] Uses shadcn Dialog primitives — consistent with existing delete confirmation in MemoryDetail
- [ ] `npm run build` passes

#### Dependencies

- **Soft dependency on TASK-2**: The dialog consumes `BatchDeleteState` type. The developer can define a local copy of the interface for now, or TASK-2 must export it. Coordinate by having TASK-2 export the type from `useDeleteMemories.ts`.

#### Parallelization notes

Safe to run concurrently with TASK-3. No file overlap. The `BatchDeleteState` type dependency on TASK-2 can be resolved by either:
- (a) TASK-2 completes first and exports the type, or
- (b) TASK-4 defines a local copy of the type and the integration task (TASK-6) reconciles

#### Verification

```bash
npm run build
# Manual: temporarily render with `open={true}` and mock state to verify each dialog state
# Verify progress bar animation, button states, summary truncation
```

---

## Phase 3 — Selection State in Card (sequential after Phase 1)

This task modifies `SearchResultCard.tsx` which was created in TASK-1. It MUST wait for TASK-1 to merge.

---

### TASK-5: Add selection mode to SearchResultCard

- [ ] **Complete**
- **Priority**: P1
- **Domain**: Frontend — component enhancement
- **Estimated effort**: S
- **Branch**: `feature/batch-delete-5-card-selection` (branch from TASK-1's branch or main after merge)
- **Files affected**:
  - `src/components/search/SearchResultCard.tsx` (MODIFY — add checkbox, selection styling, click behavior change)

#### Description

Extend `SearchResultCard` to support a selection mode where cards show checkboxes, visual selection state, and clicks toggle selection instead of navigating.

#### What to do

1. Extend `SearchResultCardProps`:

```typescript
interface SearchResultCardProps {
  result: MemorySearchResult
  query: string
  /** When true, card is in selection mode */
  selectionMode?: boolean
  /** Whether this specific card is currently selected */
  isSelected?: boolean
  /** Called when selection is toggled. If shiftKey is true, range-select is requested */
  onToggleSelect?: (id: string, shiftKey: boolean) => void
}
```

2. Behavior changes when `selectionMode` is true:
   - Show a checkbox in the top-left corner of the card (overlaying the card content area)
   - Checkbox: custom styled div (not native input) — a 16x16 rounded square with `border-border` that shows a checkmark SVG or `Check` icon from lucide when selected
   - Selected state: `border-brand-cyan-500/60 bg-brand-cyan-950/20 ring-1 ring-brand-cyan-500/20`
   - Unselected state: normal card styling (existing)
   - `onClick` calls `onToggleSelect(result.id, event.shiftKey)` instead of `navigate()`
   - `onKeyDown` Enter/Space calls `onToggleSelect` instead of navigate
   - `role` changes from `"button"` to `"option"`, add `aria-selected={isSelected}`
   - Card should still be focusable (`tabIndex={0}`)

3. When `selectionMode` is false or undefined:
   - Behavior is identical to current — no checkbox, clicks navigate

4. Checkbox visual:
   ```
   <div className={`absolute top-3 left-3 size-4 rounded border flex items-center justify-center
     transition-colors duration-150
     ${isSelected
       ? 'bg-brand-cyan-500 border-brand-cyan-500 text-white'
       : 'border-border bg-surface hover:border-text-muted'}`}>
     {isSelected && <Check className="size-3" />}
   </div>
   ```
   - Add `relative` to the Card wrapper to position the checkbox absolutely

#### Acceptance criteria

- [ ] Checkbox appears in top-left when `selectionMode` is true
- [ ] Click toggles selection (calls `onToggleSelect` with `shiftKey` flag)
- [ ] Click navigates when `selectionMode` is false (unchanged behavior)
- [ ] Selected cards have distinct border/background treatment
- [ ] Keyboard: Enter/Space toggle selection in selection mode
- [ ] `aria-selected` attribute set correctly
- [ ] Shift+click passes `shiftKey: true` to `onToggleSelect`
- [ ] `npm run build` passes

#### Dependencies

- **Hard dependency on TASK-1**: Must branch from TASK-1's merge or the extracted file won't exist

#### Parallelization notes

Cannot run in parallel with TASK-1 (same file). Can run in parallel with TASK-3 and TASK-4 if TASK-1 is already merged.

#### Verification

```bash
npm run build
# Manual: temporarily pass selectionMode={true} and dummy handlers to verify
# Verify checkbox renders, click toggles, keyboard works
# Verify normal mode still navigates
```

---

## Phase 4 — Integration (sequential, depends on all above)

This is the final task that wires everything together. It modifies `Search.tsx` and `SearchResults.tsx` — files that earlier tasks either don't touch or have already finished with.

---

### TASK-6: Wire selection state and batch delete into Search page

- [ ] **Complete**
- **Priority**: P1
- **Domain**: Frontend — integration
- **Estimated effort**: L
- **Branch**: `feature/batch-delete-6-integration` (branch from main after all previous tasks merge)
- **Files affected**:
  - `src/pages/Search.tsx` (MODIFY — add selection state, mode toggle, keyboard handlers)
  - `src/components/search/SearchResults.tsx` (MODIFY — pass selection props to cards, render BatchActionBar)

#### Description

Wire the selection model, batch action bar, confirm dialog, and delete hook together into the Search page. This is the orchestration layer.

#### What to do

**In `src/pages/Search.tsx`:**

1. Add selection state:
   ```typescript
   const [selectionMode, setSelectionMode] = useState(false)
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
   const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
   const [showDeleteDialog, setShowDeleteDialog] = useState(false)
   ```

2. Import and initialize the hook:
   ```typescript
   import { useDeleteMemories } from '@/hooks/useDeleteMemories'
   const { state: deleteState, deleteMemories, retryFailed, reset: resetDeleteState } = useDeleteMemories()
   ```

3. Selection handlers:
   - `handleToggleSelect(id, shiftKey)`:
     - If `shiftKey` and `lastSelectedId` exists: compute range from `lastSelectedId` to `id` in the current `results` array, toggle all in range
     - Otherwise: toggle single ID in `selectedIds` set
     - Update `lastSelectedId`
   - `handleSelectAll()`: add all IDs from current page results to `selectedIds`
   - `handleDeselectAll()`: clear `selectedIds`
   - `handleEnterSelectionMode()`: set `selectionMode = true`
   - `handleExitSelectionMode()`: set `selectionMode = false`, clear `selectedIds`

4. Keyboard handler (effect):
   - Listen for `Escape` key — exit selection mode
   - Only active when `selectionMode` is true

5. Clear selection when query/filters/page changes:
   ```typescript
   useEffect(() => {
     setSelectedIds(new Set())
     setLastSelectedId(null)
   }, [query, mode, filters, page])
   ```

6. Batch delete flow:
   - `handleDeleteSelected()`: open confirm dialog (`setShowDeleteDialog(true)`)
   - `handleConfirmDelete()`: call `deleteMemories([...selectedIds])`
   - On delete completion (done state): exit selection mode, close dialog, reset delete state
   - On dialog close: reset delete state if idle/done

7. Pass new props to `<SearchResults>`:
   ```tsx
   <SearchResults
     /* ...existing props... */
     selectionMode={selectionMode}
     selectedIds={selectedIds}
     onToggleSelect={handleToggleSelect}
     onEnterSelectionMode={handleEnterSelectionMode}
   />
   ```

8. Render `BatchActionBar` (conditionally, when `selectionMode && selectedIds.size > 0`):
   ```tsx
   {selectionMode && selectedIds.size > 0 && (
     <BatchActionBar
       selectedCount={selectedIds.size}
       totalCount={pageResults.length}
       onSelectAll={handleSelectAll}
       onDeselectAll={handleDeselectAll}
       onDelete={handleDeleteSelected}
       onCancel={handleExitSelectionMode}
     />
   )}
   ```

9. Render `BatchDeleteConfirmDialog`:
   ```tsx
   <BatchDeleteConfirmDialog
     open={showDeleteDialog}
     onOpenChange={setShowDeleteDialog}
     selectedMemories={selectedMemoryPreviews}
     deleteState={deleteState}
     onConfirm={handleConfirmDelete}
     onRetry={retryFailed}
     onClose={handleCloseDeleteDialog}
   />
   ```

**In `src/components/search/SearchResults.tsx`:**

1. Extend `SearchResultsProps`:
   ```typescript
   interface SearchResultsProps {
     /* ...existing... */
     selectionMode?: boolean
     selectedIds?: Set<string>
     onToggleSelect?: (id: string, shiftKey: boolean) => void
     onEnterSelectionMode?: () => void
   }
   ```

2. Add a "Select" toggle button in the results header (next to the count text):
   ```tsx
   <div className="mb-4 flex items-center justify-between">
     <p className="text-sm text-text-muted">
       {/* existing count text */}
     </p>
     {allResults.length > 0 && (
       <Button
         variant="outline" size="sm"
         onClick={() => selectionMode ? undefined : onEnterSelectionMode?.()}
         className={selectionMode ? 'bg-brand-cyan-500/20 text-brand-cyan-400' : ''}
       >
         {selectionMode ? 'Selecting...' : 'Select'}
       </Button>
     )}
   </div>
   ```

3. Pass selection props to each `SearchResultCard`:
   ```tsx
   <SearchResultCard
     key={result.id}
     result={result}
     query={trimmedQuery}
     selectionMode={selectionMode}
     isSelected={selectedIds?.has(result.id)}
     onToggleSelect={onToggleSelect}
   />
   ```

4. Add bottom padding when BatchActionBar is visible to prevent content overlap:
   ```tsx
   <div className={selectionMode ? 'pb-20' : ''}>
   ```

#### Acceptance criteria

- [ ] "Select" button appears in search results header when results exist
- [ ] Clicking "Select" enters selection mode — cards show checkboxes
- [ ] Clicking a card in selection mode toggles its selection (checkbox + visual state)
- [ ] Clicking a card outside selection mode navigates to detail (unchanged)
- [ ] Shift+click selects a range of cards between last-clicked and current
- [ ] BatchActionBar appears at bottom when items are selected
- [ ] "Select all" selects all items on current page
- [ ] "Deselect all" clears all selections
- [ ] "Cancel" exits selection mode and clears selections
- [ ] Escape key exits selection mode
- [ ] "Delete N" opens confirmation dialog
- [ ] Confirming deletion shows progress bar, then success or partial failure
- [ ] On success: selection mode exits, deleted memories disappear from results
- [ ] On partial failure: retry button re-attempts only failed deletions
- [ ] Changing query/filters/page clears selection
- [ ] Page content has bottom padding to avoid BatchActionBar overlap
- [ ] `npm run build` passes
- [ ] No regressions to existing search, pagination, or navigation behavior

#### Dependencies

- **Hard dependency on ALL previous tasks**: TASK-1 through TASK-5 must be merged

#### Parallelization notes

This is the final integration task. Cannot be parallelized with anything. Should be the last task completed.

#### Verification

```bash
npm run build
# Full manual test:
# 1. Navigate to /search, enter a query
# 2. Click "Select" — verify selection mode activates
# 3. Click cards — verify checkbox toggles
# 4. Shift+click — verify range selection
# 5. Verify BatchActionBar count updates
# 6. Click "Select all" — verify all page items selected
# 7. Click "Delete N" — verify confirm dialog with summaries
# 8. Confirm — verify progress bar, then success state
# 9. Close dialog — verify memories removed from results
# 10. Test partial failure: stop API server mid-deletion, verify retry works
# 11. Press Escape — verify selection mode exits
# 12. Change query — verify selection clears
# 13. Verify normal click-to-navigate still works when not in selection mode
```

---

## Phase 5 — Optional Enhancement

### TASK-7: Add toast notifications for batch delete results

- [ ] **Complete**
- **Priority**: P3
- **Domain**: Frontend — UX polish
- **Estimated effort**: XS
- **Branch**: `feature/batch-delete-7-toasts`
- **Files affected**:
  - `src/pages/Search.tsx` (MODIFY — add toast calls in delete completion handlers)

#### Description

After batch deletion completes, show a Sonner toast summarizing the result. The `sonner` package and `<Toaster>` component are already installed in this project.

#### What to do

1. Import `toast` from `sonner` in `Search.tsx`
2. On successful deletion: `toast.success(\`Deleted \${count} memories\`)`
3. On partial failure: `toast.error(\`\${failCount} of \${total} deletions failed\`)`

#### Acceptance criteria

- [ ] Success toast appears after full batch delete
- [ ] Error toast appears after partial failure
- [ ] Toast does not appear during individual progress — only on completion
- [ ] `npm run build` passes

#### Dependencies

- **Hard dependency on TASK-6**: Must be merged first (toast calls go in the same handlers)

#### Parallelization notes

Cannot be parallelized with TASK-6 (same file).

---

## Dependency Graph

```
TASK-1 (extract card) ──────────────────────┐
                                            ├──> TASK-5 (card selection) ──┐
TASK-2 (hook) ──────────────────────────────┤                              │
                                            │                              ├──> TASK-6 (integration) ──> TASK-7 (toasts)
TASK-3 (BatchActionBar) ───────────────────┤                              │
                                            │                              │
TASK-4 (BatchDeleteConfirmDialog) ─────────┘──────────────────────────────┘
```

## Suggested Team Assignment

| Developer | Phase 1      | Phase 2            | Phase 3         | Phase 4         |
|-----------|--------------|--------------------|-----------------|-----------------|
| Dev A     | TASK-1 (card extract) | TASK-3 (action bar)  | TASK-5 (selection) | TASK-6 (integration) |
| Dev B     | TASK-2 (hook)         | TASK-4 (dialog)      | (review/test)      | (review/test)        |

- **2 developers** can ship this in roughly 3 working sessions (Phase 1+2 parallel, Phase 3, Phase 4)
- **1 developer** can ship sequentially in ~5 sessions, following the numbered order

## Open Questions

1. **Batch delete API endpoint**: The server currently only has `DELETE /api/memories/:id` (single). Should we add a `DELETE /api/memories/batch` endpoint that accepts `{ ids: string[] }` for a single network round-trip? The current plan uses sequential single-DELETE calls which is simpler but slower for large batches. Decision: proceed with sequential for now (simpler, no server change needed), add batch endpoint as a future optimization if users commonly delete 20+ at once.

2. **Selection persistence across pages**: When the user changes pages in pagination, should selections from previous pages be preserved? The current plan clears selections on page change for simplicity. If cross-page selection is desired, TASK-6 needs additional logic to track selections globally, and the "Select all" button semantics change (all on page vs. all results).

3. **Maximum batch size**: Should there be a cap on how many memories can be deleted at once? The API fetches up to 50 results — so the practical max is 50. Consider adding a warning if selecting all 50: "You are about to delete all search results."

4. **Undo support**: The current design has no undo after deletion. Memories are permanently removed from LanceDB. If undo is desired, it would require a soft-delete mechanism on the server side — which is out of scope for this plan but worth flagging.
