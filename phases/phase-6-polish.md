# Phase 6 — Polish

> Responsive testing, loading states, keyboard shortcuts, error handling, and visual QA.

## Status: Not Started

**Depends on:** Phases 1–5 complete

---

## Tasks

### 6.1 Responsive layout testing and fixes

- [ ] Test all pages at standard breakpoints:
  - Mobile: 375px (iPhone SE), 390px (iPhone 14)
  - Tablet: 768px (iPad)
  - Desktop: 1280px, 1440px, 1920px
- [ ] Fix any layout issues found:
  - Sidebar: collapsed/hamburger on mobile, expanded on desktop
  - Cards: single column on mobile, multi-column on desktop
  - Search filter panel: collapsible on mobile
  - Tables: horizontal scroll on mobile if needed
  - Charts: readable at all sizes
- [ ] Test touch interactions on mobile (tap targets ≥ 44px)
- [ ] Verify no horizontal scrollbar appears at any breakpoint

**Verify:** Walk through every page at each breakpoint. No layout breaks, no overflow, no tiny tap targets. Sidebar collapses on mobile. All content is readable.

---

### 6.2 Loading skeletons and empty states audit

- [ ] Audit every data-fetching component — each must have:
  - Loading skeleton matching the final layout shape
  - Empty state with helpful message
- [ ] Components to check:
  - [ ] Dashboard StatsCards — skeleton for each card
  - [ ] Dashboard MemoryList — skeleton card grid
  - [ ] Dashboard TagCloud — skeleton badges
  - [ ] Dashboard Timeline — skeleton rectangle
  - [ ] Search SearchResults — skeleton result cards
  - [ ] Memory Detail — skeleton for content + metadata
  - [ ] Tags TagList — skeleton table rows
  - [ ] Tags TagChart — skeleton rectangle
- [ ] Ensure skeletons animate (pulse animation)
- [ ] Empty states should suggest an action where possible:
  - "No memories yet" → no action needed (data comes from AI agents)
  - "No results found" → "Try adjusting your search or filters"

**Verify:** Throttle network in DevTools (Slow 3G). Every component shows skeletons while loading. Clear the database (or filter to empty results) — every component shows its empty state with appropriate messaging.

---

### 6.3 Keyboard shortcuts

- [ ] Implement global keyboard shortcuts:
  - `/` — focus the search bar (if on search page) or navigate to search page
  - `Escape` — close any open modal/dialog
  - `?` — show keyboard shortcuts help dialog (optional)
- [ ] Create a keyboard shortcut handler (useEffect with keydown listener)
- [ ] Ensure shortcuts don't fire when typing in input fields
- [ ] Optional: add `k` shortcut (Cmd+K / Ctrl+K) for quick search overlay

**Verify:** Press `/` on dashboard → navigates to search page with input focused. Press `/` on search page → focuses search input. Press `Escape` → closes open modal. Shortcuts don't trigger while typing in inputs.

---

### 6.4 Error boundaries and toast notifications

- [ ] Verify `<Toaster />` from sonner is configured in app root (should be done in Phase 1.3 — if missing, add it now)
  - Confirm position (bottom-right), dark theme styling
- [ ] Add error boundary component (`src/components/ErrorBoundary.tsx`):
  - Catches render errors
  - Shows fallback UI: "Something went wrong" with retry button
  - Logs error details to console
- [ ] Wrap each page in an error boundary
- [ ] Add toast notifications for:
  - [ ] Delete success: "Memory deleted successfully" (verify toast renders — implementation is in Phase 4.3, but `<Toaster />` config is confirmed here)
  - [ ] Delete error: "Failed to delete memory"
  - [ ] Search error: "Search failed. Please try again."
  - [ ] Network error: "Unable to connect to server"
- [ ] Add global fetch error handling in `api.ts`:
  - Non-200 responses throw with server error message
  - Network failures throw with friendly message

**Verify:** Trigger an error (stop the API server, corrupt a request) — error boundary shows fallback UI, toast shows error message. Restart server, click retry — app recovers. All CRUD operations show appropriate toast on success/failure.

---

### 6.5 Final color palette tuning and visual QA

- [ ] Review all pages against design spec in plan.md:
  - Background gradient: `#0f0f1a` → `#1a1a2e`
  - Panel surfaces: `#1e1e36`, `#2a2a4a`
  - Cyan accent on interactive elements
  - Amber on tags/badges
  - Rose on destructive actions
  - Text hierarchy: white headings, `#b0b0c8` body, `#6b6b8a` muted
- [ ] Check contrast ratios meet WCAG AA (4.5:1 for text, 3:1 for large text):
  - Body text `#b0b0c8` on `#1e1e36` background
  - Muted text `#6b6b8a` on `#1e1e36` background
  - Cyan `#00d9ff` on dark backgrounds
- [ ] Verify consistent border radius across all components
- [ ] Verify consistent shadow/elevation for cards
- [ ] Check hover/focus/active states on all interactive elements:
  - Buttons have visible hover and focus ring
  - Cards have subtle hover elevation
  - Links show underline or color change on hover
- [ ] Verify no jarring color transitions or mismatched surfaces

**Verify:** Screenshot every page. Compare against design spec colors. Run a contrast checker on key text/background combinations. All interactive elements have visible hover/focus states. Visual consistency across all pages.

---

### 6.6 Performance check

- [ ] Verify no unnecessary re-renders (React DevTools Profiler)
- [ ] Ensure search debounce prevents excessive API calls
- [ ] TanStack Query cache is working (no duplicate fetches for same data)
- [ ] Charts don't re-render on unrelated state changes
- [ ] Bundle size check with `npx vite-bundle-visualizer` — ensure no oversized dependencies
- [ ] Verify `/api/stats` response time is acceptable with current database size. If slow due to full table scan, consider adding a server-side cache with a short TTL (e.g., 60 seconds)

**Verify:** Open React DevTools Profiler, interact with the app — no excessive re-renders. Network tab shows cached requests are not re-fetched. Bundle is reasonably sized (< 500KB gzipped target).

---

### 6.7 Production build verification

- [ ] Run `npm run build` — verify no TypeScript errors
- [ ] Serve the production build locally (e.g., `npx serve dist` or `npx preview`)
- [ ] Walk through all pages in the production build — confirm everything works without the Vite dev server
- [ ] Verify API proxy is handled (either through Express serving static files or a production proxy config)

**Verify:** Production build completes with no errors. All pages load and function correctly from the built output. No console errors or missing assets.

---

## Phase 6 Complete Checklist

- [ ] All pages render correctly at mobile, tablet, and desktop breakpoints
- [ ] Every data component has loading skeletons and empty states
- [ ] Keyboard shortcuts work (`/` for search, `Escape` for close)
- [ ] Error boundary catches render errors with retry
- [ ] Toast notifications for all user-facing actions
- [ ] API errors show friendly messages
- [ ] Color palette matches design spec
- [ ] Contrast ratios meet WCAG AA
- [ ] All interactive elements have hover/focus states
- [ ] No performance regressions (unnecessary re-renders, duplicate fetches)
- [ ] Bundle size is reasonable
- [ ] Production build compiles and runs correctly
