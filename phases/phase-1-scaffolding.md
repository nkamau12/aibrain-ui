# Phase 1 — Scaffolding

> Foundation: project setup, styling system, component library, API server, and end-to-end data flow.

## Status: Not Started

---

## Tasks

### 1.1 Initialize Vite + React + TypeScript project

- [ ] Run `npm create vite@latest` with React + TypeScript template (or scaffold manually inside this repo)
- [ ] Verify `npm run dev` starts the dev server and renders a default page
- [ ] Add path aliases in `tsconfig.json` (`@/` → `src/`)
- [ ] Add `vite.config.ts` path alias to match
- [ ] Install utility dependencies:
  - [ ] `npm install date-fns` — date formatting and relative timestamps
  - [ ] `npm install recharts` — charting (needed in Phase 2, install now to avoid missing peer deps)
- [ ] Create `.env` file with `PORT=3001` and `.env.example` for documentation
- [ ] Add `.env` to `.gitignore`

**Verify:** `npm run dev` opens the app at `localhost:5173` with no errors in console. `date-fns` and `recharts` are in `package.json`.

---

### 1.2 Install and configure Tailwind CSS with dark theme

- [ ] Install Tailwind CSS, PostCSS, Autoprefixer
- [ ] Create `tailwind.config.ts` with custom color palette:
  - Background: `#0f0f1a` → `#1a1a2e`
  - Panel surfaces: `#1e1e36`, `#2a2a4a`
  - Cyan accent: `#00d9ff` (9-shade scale)
  - Amber accent: `#ffd93d` (9-shade scale)
  - Rose accent: `#ff6b6b` (9-shade scale)
  - Text: headings `#ffffff`, body `#b0b0c8`, muted `#6b6b8a`
- [ ] Set up `src/index.css` with Tailwind directives and global dark theme styles (background gradient, default text color)
- [ ] Add CSS variables for the color palette (needed for shadcn/ui theming)

**Verify:** App renders with dark background gradient (`#0f0f1a` → `#1a1a2e`), body text is `#b0b0c8`. Inspect element confirms Tailwind classes are applied.

---

### 1.3 Initialize shadcn/ui and install core components

- [ ] Run `npx shadcn@latest init` — select New York style, dark theme defaults
- [ ] Configure `components.json` with correct alias paths
- [ ] Install core components:
  - [ ] `npx shadcn@latest add button`
  - [ ] `npx shadcn@latest add card`
  - [ ] `npx shadcn@latest add input`
  - [ ] `npx shadcn@latest add dialog`
  - [ ] `npx shadcn@latest add badge`
  - [ ] `npx shadcn@latest add skeleton`
  - [ ] `npx shadcn@latest add toast` (sonner)
  - [ ] `npx shadcn@latest add chart` (Recharts wrapper, if available)
- [ ] Verify `src/lib/utils.ts` exists with `cn()` utility
- [ ] Add `<Toaster />` from sonner to the app root in `main.tsx` (needed by Phase 4 for delete toasts — do not defer to Phase 6)
  - Configure position (bottom-right), dark theme styling

**Verify:** Import and render a `<Button>` and a `<Card>` on the default page. They render with correct dark theme styling. Toast provider is mounted (call `toast("test")` from console to verify).

---

### 1.4 Create app shell and routing

- [ ] Install `react-router-dom@6` (v6 required — Phase 3 uses `useSearchParams` which is a v6 API)
- [ ] Create `src/App.tsx` with route definitions:
  - `/` → Dashboard (placeholder)
  - `/search` → Search (placeholder)
  - `/tags` → Tags (placeholder)
  - `/memory/:id` → MemoryDetail (placeholder)
- [ ] Create `src/components/layout/Shell.tsx` — main layout wrapper with sidebar/header
- [ ] Create `src/components/layout/Sidebar.tsx` — navigation links to all routes
- [ ] Create `src/components/layout/Header.tsx` — page title, optional search shortcut
- [ ] Create placeholder pages in `src/pages/` (Dashboard, Search, Tags, MemoryDetail) that render their names

**Verify:** Navigate between all 4 routes using sidebar links. Each page shows its name. URL updates correctly. Browser back/forward works.

---

### 1.5 Set up Express API server

- [ ] Create `server/` directory with its own `tsconfig.json` (target: ESNext, module: commonjs or ESM)
- [ ] Install Express, cors, and ts-node/tsx for running TypeScript
- [ ] Install `concurrently` as a dev dependency (needed for combined dev script in 1.6 — install now so it's available)
- [ ] Create `server/index.ts` — Express app listening on `process.env.PORT || 3001`
- [ ] Import `aibrain-mcp` service layer:
  - Determine path to `aibrain-mcp/src/services/memory.ts` and import its functions
  - If aibrain-mcp is a sibling directory, use relative imports or npm link
- [ ] Create `server/routes/memories.ts`:
  - `GET /api/memories/recent` → calls `getRecentMemories()` with query params (limit, projectPath, agentName, tags)
  - `POST /api/memories/search` → calls `searchMemories()` with request body
    - **Important:** The frontend sends `includeContent` and `contentMaxLength` as top-level fields, but `SearchOptions` expects them nested under `resultOptions: { includeContent, contentMaxLength }`. The route must map this.
  - `GET /api/memories/:id` → calls `getMemoryById()` (always returns full content)
  - `DELETE /api/memories/:id` → calls `deleteMemory()`
- [ ] Create `server/routes/tags.ts`:
  - `GET /api/tags` → calls `listTags(agentName?, projectPath?, limit?)`
  - **Note:** `listTags` takes positional arguments, not an options object. Map query params: `?projectPath=/foo&agentName=claude&limit=50` → `listTags(agentName, projectPath, limit)`
- [ ] Create `server/routes/stats.ts`:
  - `GET /api/stats` → **custom aggregation** (no `getStats()` exists in aibrain-mcp):
    - Call `getRecentMemories({ limit: 10000 })` to get all memories
    - Compute `totalMemories` from the `total` return value
    - Compute `memoriesThisWeek` by filtering results where `createdAt` is within the last 7 days
    - Compute `topProject` by counting occurrences of each `projectPath`
    - Compute `topAgent` by counting occurrences of each `agentName`
    - Fetch `topTags` from `listTags(undefined, undefined, 10)`
  - `GET /api/stats/timeline?days=30` → group memories by `createdAt` date (truncated to day), return array of `{ date: string, count: number }` for the last N days, filling gaps with zero
- [ ] Add error handling middleware (catch errors, return JSON error responses)
- [ ] Add npm script: `"server": "tsx server/index.ts"`

**Verify:** Start server with `npm run server`. Hit each endpoint with curl:
```bash
curl http://localhost:3001/api/memories/recent?limit=5
curl -X POST http://localhost:3001/api/memories/search -H 'Content-Type: application/json' -d '{"query":"test","limit":5}'
curl http://localhost:3001/api/memories/:id   # use a real ID from the recent call
curl http://localhost:3001/api/tags
curl http://localhost:3001/api/tags?projectPath=/some/path
curl http://localhost:3001/api/stats
curl http://localhost:3001/api/stats/timeline?days=30
```
All return valid JSON with real data from LanceDB. Verify `/api/stats` fields are correct by cross-checking counts.

---

### 1.6 Configure Vite proxy

- [ ] Add proxy config in `vite.config.ts`:
  ```ts
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
  ```
- [ ] Add npm script for concurrent dev: `"dev": "concurrently \"npm run server\" \"vite\""`
  - (`concurrently` was installed in task 1.5)

**Verify:** Run `npm run dev`. From the React app, `fetch('/api/memories/recent?limit=5')` returns real data. No CORS errors in browser console.

---

### 1.7 Create API client and TanStack Query setup

- [ ] Install `@tanstack/react-query`
- [ ] Create `src/lib/api.ts` — fetch wrapper with base error handling:
  ```ts
  export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T>
  ```
  - Check `response.ok` — throw with server error message for non-200 responses
  - Catch `TypeError` for network failures — throw with friendly "Unable to connect to server" message
- [ ] Wrap `<App>` in `<QueryClientProvider>` in `main.tsx`
- [ ] Create initial hooks (stubs that will be expanded in later phases):
  - `src/hooks/useMemories.ts` — `useRecentMemories(filters)` hook
  - `src/hooks/useTags.ts` — `useTags(projectPath)` hook
  - `src/hooks/useStats.ts` — `useStats()` hook

**Verify:** Dashboard placeholder page calls `useRecentMemories()` and renders raw JSON of the first memory on screen. React Query DevTools (if installed) shows the query in cache.

---

### 1.8 Create shared TypeScript types

- [ ] Create `src/types/` directory
- [ ] Create `src/types/memory.ts` with types mirroring aibrain-mcp's data model:
  ```ts
  interface Memory {
    id: string;
    content?: string;        // Only present when includeContent is true
    summary: string;
    tags: string[];
    agentName: string;
    sessionId: string;
    projectPath: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }

  interface MemorySearchResult extends Memory {
    score?: number;          // Relevance score from search
  }

  interface TagCount {
    tag: string;
    count: number;
  }

  interface StatsResponse {
    totalMemories: number;
    memoriesThisWeek: number;
    topProject: { path: string; count: number };
    topAgent: { name: string; count: number };
    topTags: TagCount[];
  }

  interface TimelinePoint {
    date: string;
    count: number;
  }
  ```
- [ ] Export all types and use them in hooks and API client

**Important data note:** `getRecentMemories()` and `searchMemories()` return results WITHOUT the `content` field by default (only `summary`). The `content` field is only populated when `includeContent: true` is passed. MemoryCard components should rely on `summary`, not `content`. Only MemoryDetail (Phase 4) fetches full content via `getMemoryById()`.

**Verify:** All hooks and API functions use the shared types. TypeScript compiles with no type errors. Hovering over hook return values in the IDE shows correct types.

---

## Phase 1 Complete Checklist

- [ ] `npm run dev` starts both frontend and backend
- [ ] Dark theme renders with correct color palette
- [ ] shadcn components render correctly
- [ ] `<Toaster />` is mounted in app root
- [ ] All 4 routes are navigable
- [ ] All 7 API endpoints return real LanceDB data (including `/api/stats/timeline`)
- [ ] Frontend successfully fetches data through Vite proxy
- [ ] TanStack Query is wired up and caching works
- [ ] Shared TypeScript types exist and are used by all hooks
