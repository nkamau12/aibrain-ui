# Phase 3 — Search

> Full search experience with hybrid/fulltext/vector modes, filters, and result display.

## Status: Not Started

**Depends on:** Phase 2 Task 2.2 (MemoryCard component). The rest of Phase 2 (stats, timeline, tag cloud) is NOT a dependency — Phase 3 can begin as soon as MemoryCard is built.

---

## Tasks

### 3.1 Search bar with debounced input

- [ ] Create `src/components/search/SearchBar.tsx`
- [ ] Full-width input field with search icon (Lucide `Search` icon)
- [ ] Debounce input by 300ms before triggering search
- [ ] Show clear button (X) when input has text
- [ ] Auto-focus on mount
- [ ] Emit debounced query string to parent via callback

**Verify:** Type in the search bar — no API call fires until 300ms after you stop typing. Clear button clears the input and resets results. Input is focused on page load.

---

### 3.2 Search mode toggle

- [ ] Create `src/components/search/SearchModeToggle.tsx`
- [ ] Three-option segmented control or button group: Hybrid | Fulltext | Vector
- [ ] Default to "Hybrid"
- [ ] Changing mode re-triggers the current search with new mode
- [ ] Style active mode with cyan accent, inactive with muted surface

**Verify:** Toggle between modes — each triggers a new search with the selected `searchMode`. Active button is visually distinct. API request body includes correct `searchMode` value.

---

### 3.3 Filter panel

- [ ] Create `src/components/search/FilterPanel.tsx`
- [ ] Collapsible panel (expanded by default on desktop, collapsed on mobile)
- [ ] Filter controls:
  - **Project**: Dropdown/combobox populated from unique project paths in existing memories (derive from `/api/stats` or add a dedicated endpoint)
  - **Agent**: Dropdown populated from unique agent names
  - **Tags**: Multi-select tag picker (populated from `/api/tags`)
  - **Date range**: Start date and end date inputs (or a date range picker component)
- [ ] "Clear filters" button to reset all
- [ ] Filters are additive — applied together to narrow results
- [ ] Create `src/hooks/useSearchMemories.ts`:
  - Accepts query, searchMode, and all filter values
  - Calls `POST /api/memories/search` with combined params
  - **Important:** Map `includeContent` and `contentMaxLength` into `resultOptions` object before sending to API (the aibrain-mcp `SearchOptions` type nests these under `resultOptions`, not top-level)
  - Uses TanStack Query with appropriate query key including all params
  - Enabled only when query is non-empty

**Verify:** Set each filter and run a search — API request body includes correct filter values. Clear filters button resets all controls. Filters combine correctly (project + tags narrows results). On mobile, filter panel can be collapsed to save space.

---

### 3.4 Search results list

- [ ] Create `src/components/search/SearchResults.tsx`
- [ ] Reuse `MemoryCard` from Phase 2, extended with:
  - Relevance score badge (if available from search response) — display as percentage or 0-1 score
  - Highlighted matching text snippet (bold matching terms in summary)
- [ ] Display results in a list or grid layout
- [ ] Show result count header ("12 results for 'authentication'")
- [ ] Handle states:
  - **Empty query**: Show prompt text ("Start typing to search your memories")
  - **No results**: Show "No memories match your search" with suggestion to adjust filters
  - **Loading**: Show skeleton cards (3-5 skeletons)
  - **Error**: Show error message with retry button

**Verify:** Search for a known term — results appear with relevance scores. Results match the query and applied filters. All 4 states (empty/no-results/loading/error) render correctly. Click a result card → navigates to memory detail.

---

### 3.5 Client-side pagination

> **Note:** The aibrain-mcp `searchMemories()` function does NOT support an `offset` parameter. To avoid modifying the upstream service, use client-side pagination.

- [ ] Implement client-side pagination:
  - Fetch a larger result set (e.g., `limit: 50`) from the API
  - Paginate results on the frontend (e.g., show 10 per page)
  - Track current page in component state
  - Show page numbers or "Load more" button at bottom of results
- [ ] Preserve scroll position when changing pages
- [ ] Reset to page 1 when query or filters change

**Verify:** Search returns more than 10 results — pagination is visible. Navigating pages shows different results. Changing the query resets to page 1. Scroll position is maintained.

---

### 3.6 URL state sync

- [ ] Sync search state to URL query params:
  - `?q=authentication&mode=hybrid&tags=bug-fix&project=/path`
- [ ] On page load, restore search state from URL params
- [ ] This allows linking directly to a search (e.g., from tag cloud click in dashboard)
- [ ] Update URL without full page reload (use `useSearchParams` from react-router)

**Verify:** Run a search with filters → URL updates. Copy the URL, open in new tab → same search state is restored. Tag cloud click from dashboard lands on search page with tag pre-filled.

---

### 3.7 Assemble Search page

- [ ] Update `src/pages/Search.tsx` to compose all components:
  - `<SearchBar />` at top (full width)
  - `<SearchModeToggle />` below search bar
  - Layout: `<FilterPanel />` on left sidebar (desktop) or collapsible top panel (mobile)
  - `<SearchResults />` in main content area
- [ ] Ensure responsive layout

**Verify:** Full search page works end-to-end: type query → select mode → apply filters → results appear. Responsive on all breakpoints. URL reflects current state.

---

## Parallelization Note

Once MemoryCard (Task 2.2) is complete, Phase 3 can begin in parallel with the remainder of Phase 2 (tasks 2.3–2.5). Phase 4 can also begin once MemoryCard exists. Phase 5 depends only on Phase 3 Task 3.6 (URL state sync) for the click-to-search feature.

---

## Phase 3 Complete Checklist

- [ ] Search bar debounces input and auto-focuses
- [ ] Mode toggle switches between hybrid/fulltext/vector
- [ ] Filters work: project, agent, tags (multi), date range
- [ ] Results display with relevance scores
- [ ] Empty, loading, no-results, and error states all render
- [ ] Pagination or load-more works for large result sets
- [ ] URL state sync allows shareable search links
- [ ] Tag cloud click from dashboard pre-fills search
- [ ] Responsive layout on mobile and desktop
