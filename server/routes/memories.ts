import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  getRecentMemories,
  searchMemories,
  getMemoryById,
  deleteMemory,
} from '../../../aibrain-mcp/src/services/memory.js';
import type { MemoryFilters } from '../../../aibrain-mcp/src/types.js';

const router = Router();

/**
 * GET /api/memories/recent
 *
 * Query params:
 *   limit        - max results (default 20, capped at 100 by service)
 *   projectPath  - filter by project
 *   agentName    - filter by agent
 *   tags         - comma-separated tag list
 *   since        - ISO 8601 date lower bound
 *   until        - ISO 8601 date upper bound
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

    const result = await getRecentMemories(limit, Object.keys(filters).length ? filters : undefined);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/memories/search
 *
 * Body: { query, limit?, searchMode?, rrfK?, filters?, includeContent?, contentMaxLength? }
 *
 * The frontend sends includeContent and contentMaxLength at the top level.
 * searchMemories() expects them nested under resultOptions. We map them here.
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
    } = req.body as {
      query: string;
      limit?: number;
      searchMode?: 'hybrid' | 'fulltext' | 'vector';
      rrfK?: number;
      filters?: MemoryFilters;
      includeContent?: boolean;
      contentMaxLength?: number;
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
    });

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
