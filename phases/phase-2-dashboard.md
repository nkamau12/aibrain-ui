# Phase 2 — Dashboard

> Build the main dashboard page with stats, recent memories, tag cloud, and timeline.

## Status: Not Started

**Depends on:** Phase 1 (Scaffolding) complete

---

## Tasks

### 2.1 Stats cards component

- [ ] Create `src/components/dashboard/StatsCards.tsx`
- [ ] Display 4 stat cards in a responsive grid (1 col mobile, 2 col tablet, 4 col desktop):
  - **Total Memories** — number with a brain/database icon
  - **This Week** — count of memories created in the last 7 days
  - **Top Project** — project path (shortened to last segment) + count
  - **Top Agent** — agent name + count
- [ ] Use the `useStats()` hook to fetch data from `GET /api/stats`
- [ ] Add loading skeletons while data is fetching (use shadcn `<Skeleton>`)
- [ ] Style cards with panel surface color (`#1e1e36`), subtle border, cyan accent for numbers

**Verify:** Dashboard shows 4 stat cards with real data. Resize browser — cards reflow correctly. Refresh page — skeletons show briefly, then real data appears.

---

### 2.2 Recent memories grid

- [ ] Create `src/components/memories/MemoryCard.tsx`:
  - Summary text (truncated to 2-3 lines) — **use `summary` field, not `content`** (content is not returned by default from list/search endpoints)
  - Tags as colored badge pills (amber accent)
  - Project path (shortened, muted text)
  - Relative timestamp using `date-fns` `formatDistanceToNow()` ("2 hours ago", "3 days ago")
  - Click handler → navigates to memory detail or opens modal
- [ ] Create `src/components/memories/MemoryList.tsx`:
  - Accepts an array of memories and renders them in a grid
  - Responsive: 1 col mobile, 2 col tablet, 3 col desktop
- [ ] Wire up `useRecentMemories({ limit: 12 })` on the Dashboard page
- [ ] Add loading skeletons (grid of skeleton cards matching MemoryCard dimensions)
- [ ] Add empty state if no memories exist ("No memories yet")

**Verify:** Dashboard shows a grid of memory cards with real data. Each card shows summary, tags, project, and relative date. Click a card — navigates to `/memory/:id` (detail page is still placeholder, that's fine). Empty state shows if DB is empty.

---

### 2.3 Tag cloud

- [ ] Create `src/components/dashboard/TagCloud.tsx`
- [ ] Fetch tags using `useTags()` hook
- [ ] Display tags as clickable badges, sized or weighted by count:
  - More frequent tags are larger/bolder
  - Less frequent tags are smaller/muted
- [ ] Use amber accent for tag badges, with opacity/size variation
- [ ] On click → navigate to `/search?tags=<tagname>`
- [ ] Show top 20-30 tags maximum (sorted by count descending)
- [ ] Add loading skeleton

**Verify:** Tag cloud renders with real tags from the database. Tags have visible size/weight variation. Click a tag — navigates to `/search?tags=bug-fix` (search page is placeholder, URL is correct).

---

### 2.4 Timeline sparkline

- [ ] Create `src/components/dashboard/Timeline.tsx`
- [ ] Fetch timeline data from `GET /api/stats/timeline?days=30` (endpoint added in Phase 1.5)
  - Returns `{ date: string, count: number }[]` for the last 30 days with gaps filled as zero
- [ ] Render a Recharts `<AreaChart>` showing memory creation over time (last 30 days)
  - (Recharts was installed in Phase 1.1)
  - X-axis: dates
  - Y-axis: count per day
  - Area fill: cyan accent with opacity
  - Smooth curve, no grid lines for clean look
- [ ] Add loading skeleton (rectangle matching chart dimensions)

**Verify:** Timeline chart renders with real data. Shows memory creation pattern over last 30 days. Hover on data points shows tooltip with date and count. Chart is responsive — resizes with container.

---

### 2.5 Assemble Dashboard page

- [ ] Update `src/pages/Dashboard.tsx` to compose all components:
  - Page title/heading
  - `<StatsCards />` at top
  - `<Timeline />` below stats (full width)
  - Two-column layout below:
    - Left (wider): `<MemoryList />` with "Recent Memories" heading
    - Right (narrower): `<TagCloud />` with "Top Tags" heading
  - On mobile: single column, stacked vertically
- [ ] Ensure consistent spacing between sections (Tailwind spacing scale)

**Verify:** Full dashboard renders with all 4 sections. Layout is visually balanced. Mobile view stacks cleanly. All data is real. No console errors.

---

## Phase 2 Complete Checklist

- [ ] Stats cards show real aggregated data with loading states
- [ ] Memory cards display summary, tags, project, relative date
- [ ] Memory card click navigates to detail route
- [ ] Tag cloud renders with weighted sizing and click-to-search
- [ ] Timeline chart shows memory creation over time
- [ ] Dashboard layout is responsive (mobile, tablet, desktop)
- [ ] All sections have loading skeletons
- [ ] Empty states display correctly when no data exists
