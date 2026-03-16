# aiBrain UI — Build Plan

A React web app to visualize, search, and manage aiBrain memories through the browser.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **UI Library** | shadcn/ui + Tailwind CSS | Copy-paste ownership, dark-mode-first, beautiful defaults — aligns with dark theme + vibrant accents aesthetic |
| **Primitives** | Radix UI (via shadcn) | Accessible, keyboard-navigable components out of the box |
| **Icons** | Lucide React (bundled with shadcn) | Consistent, clean icon set |
| **Charts/Viz** | Recharts (shadcn charts component) | Tag distribution bar charts, memory-over-time timeline |
| **Build Tool** | Vite | Fast dev server, instant HMR |
| **Backend** | Express.js thin API server | Imports `aibrain-mcp/src/services/memory.ts` directly — reuses all existing search/CRUD logic against LanceDB |
| **State** | TanStack Query (React Query) | Caching, optimistic deletes, search debounce |

---

## 2. Design Principles

Based on [Creating Beautiful Frontend Apps: A Guide to Consistent Aesthetics](https://medium.com/design-bootcamp/creating-beautiful-frontend-apps-a-guide-to-consistent-aesthetics-d7fdef10eb9a).

### Color Palette

- **Background gradient**: Deep navy to charcoal (`#0f0f1a` → `#1a1a2e`)
- **Panel colors**: `#1e1e36` (card surface), `#2a2a4a` (elevated surface)
- **Primary accent (Cyan)**: `#00d9ff` — interactive elements, links, primary buttons
- **Secondary accent (Amber)**: `#ffd93d` — tags, highlights, badges
- **Danger accent (Rose)**: `#ff6b6b` — delete actions, destructive operations
- **Text hierarchy**:
  - Headings: `#ffffff`
  - Body: `#b0b0c8`
  - Muted/metadata: `#6b6b8a`

Each accent color should have a 9-shade scale (light → dark) generated via [coolors.co gradient palette](https://coolors.co/gradient-palette/) for subtle hover/active/disabled variations.

### Layout Rules

- **Card-based layout** — single-column on mobile, multi-column grid on desktop
- **Minimal bright color usage** — only on interactive elements to draw focus
- **Consistent spacing** — use Tailwind's spacing scale (4, 6, 8 units)
- **Glassmorphism-light** — subtle border + backdrop blur on cards (optional)
- **Mobile-first** — responsive breakpoints with column unwrapping

---

## 3. Pages & Features

### Dashboard (`/`)

- **Stats cards**: Total memories, memories this week, top project, top agent
- **Recent memories list**: Card grid showing summary, tags (colored pills), project, date
- **Tag cloud**: Visual tag distribution (clickable → filters search)
- **Timeline sparkline**: Memories created over time (Recharts area chart)

### Search (`/search`)

- **Search bar** with mode toggle (hybrid / fulltext / vector)
- **Filter sidebar/panel**: agent, project, tags (multi-select), date range picker
- **Results list**: Cards with summary, highlighted matching text, relevance score badge, tags
- **Pagination** or infinite scroll

### Memory Detail (modal or `/memory/:id`)

- Full content rendered with markdown support
- Metadata table: agent, session, project, created date
- Tags displayed as colored pills
- **Delete button** with confirmation dialog

### Tags Explorer (`/tags`)

- Tag list with counts (bar chart + sortable list view)
- Click any tag → navigate to `/search` pre-filtered by that tag

---

## 4. Architecture

```
┌──────────────────────────────┐
│   aibrain-ui (React SPA)     │
│   Vite + shadcn/ui + TW      │
│                              │
│  Dashboard | Search | Tags   │
│  MemoryDetail (modal)        │
└──────────┬───────────────────┘
           │ fetch /api/*
           ▼
┌──────────────────────────────┐
│   Express API Server         │
│   routes/memories.ts         │
│   routes/tags.ts             │
│   routes/stats.ts            │
└──────────┬───────────────────┘
           │ direct import
           ▼
┌──────────────────────────────┐
│   aibrain-mcp                │
│   services/memory.ts         │
│   LanceDB (~/.aibrain/)      │
└──────────────────────────────┘
```

---

## 5. Project Structure

```
aibrain-ui/
├── server/                        # Express API backend
│   ├── index.ts                   # Server entry point
│   ├── routes/
│   │   ├── memories.ts            # Memory CRUD + search endpoints
│   │   ├── tags.ts                # Tag listing endpoint
│   │   └── stats.ts               # Aggregated stats endpoint
│   └── tsconfig.json
├── src/                           # React frontend (Vite)
│   ├── components/
│   │   ├── ui/                    # shadcn components (button, card, input, dialog…)
│   │   ├── layout/                # Shell, Sidebar, Header
│   │   ├── memories/              # MemoryCard, MemoryDetail, MemoryList
│   │   ├── search/                # SearchBar, FilterPanel, SearchResults
│   │   └── dashboard/             # StatsCards, TagCloud, Timeline
│   ├── lib/
│   │   ├── api.ts                 # Fetch wrapper for /api/*
│   │   └── utils.ts               # shadcn cn() utility
│   ├── hooks/
│   │   ├── useMemories.ts         # TanStack Query hooks for memories
│   │   ├── useTags.ts             # TanStack Query hooks for tags
│   │   └── useStats.ts            # TanStack Query hooks for stats
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Search.tsx
│   │   ├── Tags.tsx
│   │   └── MemoryDetail.tsx
│   ├── App.tsx                    # Router + Layout
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Tailwind + dark theme globals
├── package.json
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
└── plan.md                        # This file
```

---

## 6. API Endpoints

| Method | Endpoint | Maps to | Description |
|---|---|---|---|
| `GET` | `/api/memories/recent?limit=20&projectPath=...` | `getRecentMemories()` | List recent memories with optional filters |
| `POST` | `/api/memories/search` | `searchMemories()` | Hybrid/fulltext/vector search with filters |
| `GET` | `/api/memories/:id` | `getMemoryById()` | Get full memory content by ID |
| `DELETE` | `/api/memories/:id` | `deleteMemory()` | Delete a specific memory |
| `GET` | `/api/tags?projectPath=...` | `listTags()` | List all tags with counts |
| `GET` | `/api/stats` | Custom aggregation | Dashboard statistics |

### Request/Response Examples

**POST `/api/memories/search`**
```json
{
  "query": "authentication bug fix",
  "limit": 10,
  "searchMode": "hybrid",
  "filters": {
    "projectPath": "/Users/nkamau/Development/nisaidie",
    "tags": ["bug-fix"]
  },
  "includeContent": true,
  "contentMaxLength": 500
}
```

**GET `/api/stats`** → Response
```json
{
  "totalMemories": 49,
  "memoriesThisWeek": 12,
  "topProject": { "path": "/Users/nkamau/Development/nisaidie", "count": 30 },
  "topAgent": { "name": "claude-code", "count": 49 },
  "topTags": [
    { "tag": "bug-fix", "count": 8 },
    { "tag": "architecture", "count": 6 }
  ]
}
```

---

## 7. Data Model Reference

From `aibrain-mcp/src/types.ts`:

```typescript
interface MemoryDocument {
  id: string;
  content: string;
  summary: string;
  embedding: number[] | null;
  tags: string[];
  agentName: string;
  sessionId: string;
  projectPath: string;
  createdAt: string;         // ISO 8601
  metadata: Record<string, unknown>;
  contentAndSummary: string; // FTS indexed field
}
```

---

## 8. Implementation Phases

### Phase 1 — Scaffolding
- Vite + React + TypeScript project setup
- Tailwind CSS with dark theme color palette
- shadcn/ui initialization + core components (Button, Card, Input, Dialog, Badge)
- Express API server with all 6 endpoints
- Vite proxy config for `/api` → Express
- Verify end-to-end: frontend fetches real data from LanceDB

### Phase 2 — Dashboard
- Stats cards component (total, this week, top project, top agent)
- Recent memories grid (MemoryCard component with summary, tags, date)
- Tag cloud visualization (clickable tags)
- Timeline sparkline (Recharts area chart)

### Phase 3 — Search
- Search bar with debounced input
- Search mode toggle (hybrid / fulltext / vector)
- Filter panel (agent, project, tags multi-select, date range)
- Results list with relevance score badges
- Loading skeletons during search

### Phase 4 — Memory Detail + Delete
- Memory detail view (modal or page) with full markdown-rendered content
- Metadata display table
- Delete button with confirmation dialog
- Optimistic delete with TanStack Query cache invalidation

### Phase 5 — Tags Explorer
- Tags list with counts (sortable table)
- Tag distribution bar chart (Recharts)
- Click-to-search navigation

### Phase 6 — Polish
- Responsive layout testing (mobile, tablet, desktop)
- Loading skeletons and empty states for all pages
- Keyboard shortcuts (/ to focus search, Esc to close modals)
- Error boundaries and toast notifications
- Final color palette tuning and visual QA
