# Phase 5 — Tags Explorer

> Dedicated page for browsing, sorting, and visualizing tags with click-to-search navigation.

## Status: Not Started

**Depends on:** Phase 3 (Search page with URL state sync for tag filtering)

---

## Tasks

### 5.1 Tags list with counts

- [ ] Create `src/components/tags/TagList.tsx`
- [ ] Fetch all tags using `useTags()` hook (from `GET /api/tags`)
  - Note: `useTags()` should accept optional `projectPath` and `agentName` filter params to pass through to the API
- [ ] Display as a sortable table/list:
  - Columns: Tag name (badge), Count, Actions (→ search link)
  - Default sort: count descending (most used first)
  - Allow toggling sort: by count (desc/asc) or alphabetical (a-z/z-a)
- [ ] Click sort headers to toggle sort direction
- [ ] Add loading skeletons (table rows)
- [ ] Add empty state: "No tags found" if database is empty
- [ ] Optional: search/filter input to narrow down tag list by name

**Verify:** Tags page shows all tags with correct counts. Click column headers to re-sort — order changes correctly. Counts match what's shown in the dashboard tag cloud. Loading skeleton shows on first load.

---

### 5.2 Tag distribution bar chart

- [ ] Create `src/components/tags/TagChart.tsx`
- [ ] Use Recharts `<BarChart>` to visualize tag distribution
  - X-axis: tag names (top 15-20 tags)
  - Y-axis: count
  - Bar color: amber accent (`#ffd93d`)
  - Hover tooltip showing tag name and exact count
- [ ] Responsive: horizontal bars on mobile (more readable), vertical bars on desktop
- [ ] Add loading skeleton matching chart dimensions

**Verify:** Bar chart renders with real tag data. Hover shows tooltip. Chart is responsive — readable on both mobile and desktop. Top tags are clearly visible.

---

### 5.3 Click-to-search navigation

- [ ] Each tag in the list should be clickable → navigates to `/search?tags=<tagname>`
- [ ] Add a small arrow/link icon next to each tag indicating it's clickable
- [ ] Clicking a bar in the chart also navigates to search filtered by that tag
- [ ] Ensure the search page correctly reads the `tags` URL param and applies it as a filter on load

**Verify:** Click a tag in the list → lands on search page with that tag pre-selected in filters. Click a bar in the chart → same behavior. Search results are filtered to only memories with that tag.

---

### 5.4 Assemble Tags page

- [ ] Update `src/pages/Tags.tsx` to compose all components:
  - Page title: "Tags Explorer"
  - `<TagChart />` at top (full width, ~300px height)
  - `<TagList />` below chart
- [ ] Responsive layout
- [ ] Consistent spacing

**Verify:** Full tags page renders with chart and list. Both show the same data. Clicking tags from either navigates to search. Page is responsive.

---

## Phase 5 Complete Checklist

- [ ] Tag list displays all tags with counts
- [ ] List is sortable by count and alphabetically
- [ ] Bar chart visualizes top tags distribution
- [ ] Chart has hover tooltips with exact counts
- [ ] Click any tag (list or chart) → navigates to search with tag filter
- [ ] Search page correctly applies tag filter from URL
- [ ] Loading skeletons for both list and chart
- [ ] Empty state when no tags exist
- [ ] Responsive layout on all breakpoints
