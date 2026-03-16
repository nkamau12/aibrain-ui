import { Router, type Request, type Response, type NextFunction } from 'express';
import { listTags } from '../../../aibrain-mcp/src/services/memory.js';
import { getTable } from '../../../aibrain-mcp/src/db/init.js';

const router = Router();

/**
 * Fetch all memory rows directly from LanceDB for aggregation.
 * We bypass getRecentMemories() because its limit cap (100) would corrupt
 * aggregate counts for users with large memory stores.
 */
async function fetchAllRows(): Promise<Array<Record<string, unknown>>> {
  const table = await getTable();
  // LanceDB defaults to limit=10 without an explicit .limit() call
  const rows = await table.query().limit(1_000_000).toArray();
  return rows as Array<Record<string, unknown>>;
}

/**
 * GET /api/stats
 *
 * Returns aggregated statistics:
 *   totalMemories    - total count of all memories
 *   memoriesThisWeek - count of memories created in the last 7 days
 *   topProject       - project with the most memories { path, count }
 *   topAgent         - agent with the most memories { name, count }
 *   topTags          - top 10 tags [{ tag, count }]
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows, tagsResult] = await Promise.all([
      fetchAllRows(),
      listTags(undefined, undefined, 10),
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();

    const projectCounts = new Map<string, number>();
    const agentCounts = new Map<string, number>();
    let memoriesThisWeek = 0;

    for (const row of rows) {
      const createdAt = row.createdAt as string | undefined;
      if (createdAt && createdAt >= cutoff) {
        memoriesThisWeek++;
      }

      const projectPath = (row.projectPath as string | undefined) ?? '';
      projectCounts.set(projectPath, (projectCounts.get(projectPath) ?? 0) + 1);

      const agentName = (row.agentName as string | undefined) ?? '';
      agentCounts.set(agentName, (agentCounts.get(agentName) ?? 0) + 1);
    }

    const topProjectEntry = [...projectCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topAgentEntry = [...agentCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    // All distinct projects and agents, sorted by count descending
    const projects = [...projectCounts.entries()]
      .filter(([path]) => path !== '')
      .sort((a, b) => b[1] - a[1])
      .map(([path, count]) => ({ path, count }));

    const agents = [...agentCounts.entries()]
      .filter(([name]) => name !== '')
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    res.json({
      totalMemories: rows.length,
      memoriesThisWeek,
      topProject: topProjectEntry
        ? { path: topProjectEntry[0], count: topProjectEntry[1] }
        : { path: '', count: 0 },
      topAgent: topAgentEntry
        ? { name: topAgentEntry[0], count: topAgentEntry[1] }
        : { name: '', count: 0 },
      topTags: tagsResult.tags,
      projects,
      agents,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stats/timeline
 *
 * Query params:
 *   days - number of days to include (default 30)
 *
 * Returns [{ date: "YYYY-MM-DD", count: number }] for the last N days,
 * with zero-filled gaps for days with no memories.
 */
router.get('/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = req.query.days ? parseInt(String(req.query.days), 10) : 30;

    // Build the set of date strings we need to cover
    const today = new Date();
    const dateLabels: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dateLabels.push(d.toISOString().slice(0, 10));
    }

    const cutoff = dateLabels[0]; // earliest date we care about

    const rows = await fetchAllRows();
    const countsByDate = new Map<string, number>();

    for (const row of rows) {
      const createdAt = row.createdAt as string | undefined;
      if (!createdAt) continue;

      const dateKey = createdAt.slice(0, 10);
      if (dateKey < cutoff) continue;

      countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
    }

    const timeline = dateLabels.map((date) => ({
      date,
      count: countsByDate.get(date) ?? 0,
    }));

    res.json(timeline);
  } catch (err) {
    next(err);
  }
});

export default router;
