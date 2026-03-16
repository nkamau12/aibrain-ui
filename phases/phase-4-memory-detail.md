# Phase 4 — Memory Detail + Delete

> View full memory content with markdown rendering, metadata display, and delete functionality.

## Status: Not Started

**Depends on:** Phase 2 (MemoryCard click handler), Phase 3 (search result click)

---

## Tasks

### 4.1 Memory detail view

- [ ] Decide on modal vs. dedicated page (recommendation: modal on desktop, full page on mobile)
- [ ] Create `src/components/memories/MemoryDetail.tsx`
- [ ] Install markdown and syntax highlighting packages:
  ```bash
  npm install react-markdown remark-gfm rehype-highlight highlight.js
  ```
- [ ] Layout:
  - **Header**: Memory summary as title, close button (X) if modal
  - **Content area**: Full `content` field rendered as markdown with:
    - Proper heading styles
    - Code blocks with syntax highlighting (dark theme)
    - Lists, links, tables, bold/italic
    - Scrollable if content exceeds viewport
  - **Metadata section** (below or sidebar):
    - Agent name
    - Session ID
    - Project path
    - Created date formatted with `date-fns` `format()`: "March 16, 2026 at 4:30 PM"
    - Tags as badge pills
  - **Actions**: Delete button (bottom or header)
- [ ] Create `src/hooks/useMemory.ts`:
  - `useMemory(id)` — fetches single memory from `GET /api/memories/:id`
  - Loading and error states
- [ ] Add loading skeleton matching the detail layout

**Verify:** Click a memory card from dashboard or search → detail view opens showing full markdown-rendered content. Code blocks have syntax highlighting. Metadata displays correctly. Close button returns to previous view.

---

### 4.2 Modal implementation (if using modal approach)

- [ ] Use shadcn `<Dialog>` component as the modal container
- [ ] Modal should be large (max-width ~800px, max-height 80vh)
- [ ] Scrollable content area within modal
- [ ] Close on Escape key press
- [ ] Close on backdrop click
- [ ] Update URL to `/memory/:id` when modal opens (for shareable links)
- [ ] If navigated directly to `/memory/:id`, render as full page instead of modal
- [ ] Animate open/close (shadcn Dialog has built-in transitions)

**Verify:** Modal opens with animation. Escape closes it. Backdrop click closes it. URL updates to `/memory/:id`. Direct navigation to `/memory/:id` renders full page view. Scrolling works for long content.

---

### 4.3 Delete with confirmation

> **Prerequisite:** `<Toaster />` from sonner must be configured in the app root (done in Phase 1.3). If not, add it now before proceeding.

- [ ] Add delete button to MemoryDetail (rose/red accent, trash icon)
- [ ] On click → show confirmation dialog:
  - "Are you sure you want to delete this memory?"
  - Show memory summary in the confirmation
  - Two buttons: "Cancel" (secondary) and "Delete" (destructive/rose)
- [ ] Create `useDeleteMemory()` hook:
  - Calls `DELETE /api/memories/:id`
  - On success: close detail view, show success toast ("Memory deleted successfully"), invalidate relevant queries
  - On error: show error toast with message ("Failed to delete memory")
- [ ] Implement optimistic delete with TanStack Query:
  - Immediately remove the memory from cached lists
  - If delete fails, roll back the cache and show error

**Verify:** Click delete → confirmation dialog appears with memory summary. Cancel dismisses dialog without action. Confirm delete → memory disappears from list, success toast shows. Refresh page → memory is gone (actually deleted from LanceDB). To test error handling: stop the Express server, attempt a delete → memory reappears in the list after rollback, error toast shows. Restart server to confirm app recovers.

---

### 4.4 Wire up navigation from all entry points

- [ ] Dashboard: MemoryCard click → opens detail
- [ ] Search: Result card click → opens detail
- [ ] Direct URL: `/memory/:id` → renders detail (full page)
- [ ] After delete: navigate back to previous page (dashboard or search)
- [ ] Handle invalid ID (memory not found): show 404 state with "Memory not found" message and link back to dashboard

**Verify:** Access memory detail from dashboard, search results, and direct URL — all work. Delete from each context returns to the correct page. Invalid ID shows 404 state.

---

## Phase 4 Complete Checklist

- [ ] Memory detail renders full markdown content with syntax highlighting
- [ ] Metadata displays: agent, session, project, date, tags
- [ ] Modal opens/closes correctly with animation, Escape, backdrop click
- [ ] URL updates to `/memory/:id` when viewing detail
- [ ] Direct navigation to `/memory/:id` works
- [ ] Delete button shows confirmation dialog
- [ ] Delete removes memory from LanceDB and invalidates caches
- [ ] Optimistic delete with rollback on error
- [ ] Success and error toasts display correctly
- [ ] 404 state for invalid memory IDs
- [ ] Works from all entry points (dashboard, search, direct URL)
