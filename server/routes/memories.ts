import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  getRecentMemories,
  searchMemories,
  getMemoryById,
  deleteMemory,
  getRelatedMemories,
} from '../../../aibrain-mcp/src/services/memory.js';
import type { MemoryFilters } from '../../../aibrain-mcp/src/types.js';

const router = Router();

/**
 * GET /api/memories/recent
 *
 * Query params:
 *   limit         - max results (default 20, capped at 100 by service)
 *   projectPath   - filter by project
 *   agentName     - filter by agent
 *   tags          - comma-separated tag list
 *   since         - ISO 8601 date lower bound
 *   until         - ISO 8601 date upper bound
 *   cluster       - filter by cluster name
 *   include_stale - include stale (superseded) memories ("true" / "1" = yes)
 */
router.get('/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const filters: MemoryFilters = {};
    if (req.query.projectPath !== undefined) filters.projectPath = String(req.query.projectPath);
    if (req.query.agentName) filters.agentName = String(req.query.agentName);
    if (req.query.tags) filters.tags = String(req.query.tags).split(',').filter(Boolean);
    if (req.query.since) filters.since = String(req.query.since);
    if (req.query.until) filters.until = String(req.query.until);
    if (req.query.cluster) filters.cluster = String(req.query.cluster);
    if (req.query.include_stale !== undefined) {
      const raw = String(req.query.include_stale);
      filters.include_stale = raw === 'true' || raw === '1';
    }

    const result = await getRecentMemories(limit, Object.keys(filters).length ? filters : undefined);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/memories/search
 *
 * Body:
 *   query            - required search string
 *   limit?           - max results
 *   searchMode?      - "hybrid" | "fulltext" | "vector"
 *   rrfK?            - RRF k parameter
 *   filters?         - { agentName, sessionId, projectPath, tags, since, until, cluster }
 *   includeContent?  - include full content in results
 *   contentMaxLength? - truncate content at this length
 *   include_related? - attach related memories to each result (BFS by ID)
 *   related_depth?   - BFS hop depth (1 or 2)
 *   include_stale?   - include stale (superseded) memories in results
 *
 * The frontend sends includeContent and contentMaxLength at the top level.
 * searchMemories() expects them nested under resultOptions. We map them here.
 * include_related, related_depth, and include_stale are top-level SearchOptions
 * fields (not filter fields) and are passed through directly.
 */
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      query,
      limit,
      searchMode,
      rrfK,
      filters,
      includeContent,
      contentMaxLength,
      include_related,
      related_depth,
      include_stale,
    } = req.body as {
      query: string;
      limit?: number;
      searchMode?: 'hybrid' | 'fulltext' | 'vector';
      rrfK?: number;
      filters?: MemoryFilters;
      includeContent?: boolean;
      contentMaxLength?: number;
      include_related?: boolean;
      related_depth?: number;
      include_stale?: boolean;
    };

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Missing required field: query (string)' });
      return;
    }

    const result = await searchMemories({
      query,
      limit,
      searchMode,
      rrfK,
      filters,
      resultOptions: {
        includeContent,
        contentMaxLength,
      },
      include_related,
      related_depth,
      include_stale,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/memories/:id/related
 *
 * Returns the BFS-traversed relationship graph rooted at the given memory.
 *
 * Query params:
 *   depth           - traversal depth (number, default 1, max 3)
 *   relation_types  - comma-separated list of relation types to follow
 *                     (e.g. "supersedes,see-also"); omit to follow all types
 *   include_stale   - include stale (superseded) nodes (boolean, default false)
 *   include_content - include full content on each node (boolean, default false)
 *
 * Response: { root, nodes } | { root: null, nodes: [], error }
 *
 * NOTE: this route must appear before /:id so Express does not swallow
 * "related" as the :id segment.
 */
router.get('/:id/related', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // --- depth ---
    const rawDepth = req.query.depth !== undefined ? parseInt(String(req.query.depth), 10) : 1;
    if (isNaN(rawDepth) || rawDepth < 1 || rawDepth > 3) {
      res.status(400).json({ error: 'Invalid param: depth must be an integer between 1 and 3' });
      return;
    }

    // --- relation_types ---
    const relationTypes: string[] | undefined = req.query.relation_types
      ? String(req.query.relation_types).split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    // --- include_stale ---
    const rawIncludeStale = req.query.include_stale;
    const includeStale =
      rawIncludeStale === 'true' ? true : rawIncludeStale === 'false' ? false : false;

    // --- include_content ---
    const rawIncludeContent = req.query.include_content;
    const includeContent =
      rawIncludeContent === 'true' ? true : rawIncludeContent === 'false' ? false : false;

    const result = await getRelatedMemories(id, rawDepth, relationTypes, includeContent, includeStale);

    if (result.error && result.root === null) {
      res.status(404).json(result);
      return;
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/memories/:id
 * Always returns full content (getMemoryById always passes includeContent: true).
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memory = await getMemoryById(req.params.id);
    if (!memory) {
      res.status(404).json({ error: `Memory not found: ${req.params.id}` });
      return;
    }
    res.json(memory);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/memories/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteMemory(req.params.id);
    if (!result.success) {
      res.status(500).json({ error: result.error ?? 'Failed to delete memory' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
