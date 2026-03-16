import { Router, type Request, type Response, type NextFunction } from 'express';
import { listTags } from '../../../aibrain-mcp/src/services/memory.js';

const router = Router();

/**
 * GET /api/tags
 *
 * Query params (all optional):
 *   agentName   - filter by agent
 *   projectPath - filter by project
 *   limit       - max tag count (default 100)
 *
 * listTags() takes positional args: listTags(agentName?, projectPath?, limit?)
 * We map query params to those positions explicitly.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentName = req.query.agentName ? String(req.query.agentName) : undefined;
    const projectPath = req.query.projectPath !== undefined ? String(req.query.projectPath) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;

    const result = await listTags(agentName, projectPath, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
