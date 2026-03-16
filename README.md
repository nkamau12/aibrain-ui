# aibrain-ui

A dark-themed web dashboard for visualizing, searching, and managing [aibrain-mcp](https://github.com/nkamau12/aibrain-mcp) memories stored in LanceDB.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue) ![Vite](https://img.shields.io/badge/Vite-8-purple) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-cyan)

## Features

- **Dashboard** — stats cards, recent memories, tag cloud, timeline chart
- **Search** — hybrid, full-text, and vector search with filters (agent, project, tags, date range)
- **Batch delete** — select multiple memories and delete in bulk with progress tracking
- **Memory detail** — full markdown rendering with syntax highlighting
- **Tags explorer** — sortable tag list, bar chart, click-to-search
- **Keyboard shortcuts** — `/` to focus search, `Escape` to clear

## Prerequisites

- **Node.js** 18+
- **[aibrain-mcp](https://github.com/nkamau12/aibrain-mcp)** — cloned and built as a sibling directory

### aibrain-mcp setup

aibrain-ui imports aibrain-mcp services directly via relative path, so both repos must live side-by-side:

```
~/Development/          # or wherever you keep your projects
├── aibrain-mcp/        # ← clone and build this first
└── aibrain-ui/         # ← this repo
```

1. Clone and build aibrain-mcp:

```bash
git clone https://github.com/nkamau12/aibrain-mcp.git
cd aibrain-mcp
npm install
npm run build
```

2. Confirm aibrain-mcp's LanceDB store exists at `~/.aibrain/`. It gets created automatically when memories are saved through the MCP server.

> **If your directories aren't siblings**, update the relative import paths in `server/routes/memories.ts`, `server/routes/stats.ts`, and `server/routes/tags.ts`. They currently reference `../../../aibrain-mcp/src/...`.

## Getting started

```bash
# Clone this repo
git clone https://github.com/nkamau12/aibrain-ui.git
cd aibrain-ui

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start dev server (Express API + Vite frontend)
npm run dev
```

This starts:
- **Frontend** at [http://localhost:5173](http://localhost:5173)
- **API server** at [http://localhost:3001](http://localhost:3001)

Vite proxies all `/api` requests to the Express server automatically.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Express API server port |

Edit `.env` to change the port. If you change it, also update the proxy target in `vite.config.ts`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both API server and Vite dev server |
| `npm run server` | Start Express API server only |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Tech stack

- **Frontend** — React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, Recharts, React Router v6
- **Backend** — Express 5, direct imports from aibrain-mcp service layer
- **Database** — LanceDB (via aibrain-mcp)

## License

MIT
