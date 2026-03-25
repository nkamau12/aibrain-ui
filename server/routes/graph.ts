import { Router, type Request, type Response, type NextFunction } from 'express';
import { fetchAllRows } from '../lib/db.js';

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelatedIdEntry {
  id: string;
  relation_type: string;
}

interface GraphNode {
  id: string;
  summary: string;
  cluster: string;
  tags: string[];
  projectPath: string;
  agentName: string;
  createdAt: string;
  is_stale: boolean;
  connectionCount: number;
}

interface GraphLink {
  source: string;
  target: string;
  relation_type: string;
}

interface GraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
  truncated: boolean;
  totalMemories: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

/**
 * Columns to fetch from LanceDB. We explicitly exclude `embedding` (large
 * float array) and `contentAndSummary` (duplicate text) since they add
 * significant payload for no benefit in graph construction.
 */
const GRAPH_COLUMNS = [
  'id',
  'summary',
  'cluster',
  'tags',
  'projectPath',
  'agentName',
  'createdAt',
  'related_ids',
  'is_stale',
  'metadata',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  // Arrow List/Vector objects are iterable but not plain arrays
  if (raw != null && typeof (raw as any)[Symbol.iterator] === 'function') {
    return Array.from(raw as Iterable<string>);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseRelatedIds(raw: unknown): RelatedIdEntry[] {
  if (Array.isArray(raw)) return raw as RelatedIdEntry[];
  // Arrow List/Vector objects are iterable but not plain arrays
  if (raw != null && typeof (raw as any)[Symbol.iterator] === 'function') {
    return Array.from(raw as Iterable<RelatedIdEntry>);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Produce a stable canonical link key for deduplicating bidirectional edges.
 * We sort the two IDs lexicographically so A→B and B→A with the same
 * relation_type collapse to a single canonical entry.
 */
function canonicalLinkKey(a: string, b: string, relationType: string): string {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `${lo}::${hi}::${relationType}`;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * GET /api/graph
 *
 * Returns pre-computed graph data (nodes + links) for the Brain Graph
 * visualization. All graph construction happens in a single LanceDB query;
 * there are no per-node follow-up queries.
 *
 * Query params:
 *   projectPath?   - filter to memories matching this project path
 *   cluster?       - filter to memories matching this cluster
 *   tags?          - comma-separated tag names; keep rows with at least one match
 *   includeStale?  - "true" to include stale (superseded) memories (default false)
 *   limit?         - max nodes to return (default 500, max 2000)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // --- Parse query params ---------------------------------------------------
    const projectPathFilter = req.query.projectPath
      ? String(req.query.projectPath)
      : undefined;

    const clusterFilter = req.query.cluster
      ? String(req.query.cluster)
      : undefined;

    const tagsFilter: string[] =
      req.query.tags && typeof req.query.tags === 'string'
        ? req.query.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

    const includeStale = String(req.query.includeStale).toLowerCase() === 'true';

    const rawLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : DEFAULT_LIMIT;
    const limit = Number.isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);

    // --- Fetch all rows (single DB query, no embedding/contentAndSummary) ----
    const rows = await fetchAllRows(GRAPH_COLUMNS);

    // --- Filter rows ---------------------------------------------------------
    const filtered = rows.filter((row) => {
      // Stale filter — skip stale rows unless caller opts in
      if (!includeStale && row.is_stale === true) return false;

      // Project path filter
      if (projectPathFilter !== undefined && row.projectPath !== projectPathFilter) return false;

      // Cluster filter
      if (clusterFilter !== undefined && row.cluster !== clusterFilter) return false;

      // Tags filter — at least one tag must match
      if (tagsFilter.length > 0) {
        const rowTags = parseTags(row.tags);
        const hasMatch = tagsFilter.some((t) => rowTags.includes(t));
        if (!hasMatch) return false;
      }

      return true;
    });

    // --- Sort by createdAt descending, then apply limit ----------------------
    const totalMemories = filtered.length;

    filtered.sort((a, b) => {
      const aDate = (a.createdAt as string) ?? '';
      const bDate = (b.createdAt as string) ?? '';
      return bDate.localeCompare(aDate);
    });

    const truncated = totalMemories > limit;
    const limited = filtered.slice(0, limit);

    // --- Build node index (id → node) for fast link validation ---------------
    const nodeMap = new Map<string, GraphNode>();

    for (const row of limited) {
      const id = row.id as string;
      nodeMap.set(id, {
        id,
        summary: (row.summary as string) ?? '',
        cluster: (row.cluster as string) ?? '',
        tags: parseTags(row.tags),
        projectPath: (row.projectPath as string) ?? '',
        agentName: (row.agentName as string) ?? '',
        createdAt: (row.createdAt as string) ?? '',
        is_stale: row.is_stale === true,
        connectionCount: 0, // populated after link-building
      });
    }

    // --- Build links ---------------------------------------------------------
    // We deduplicate bidirectional links: A→B and B→A with the same
    // relation_type collapse to one entry keyed by canonical (min, max) order.
    const seenLinks = new Map<string, GraphLink>();

    for (const row of limited) {
      const sourceId = row.id as string;
      const relatedIds = parseRelatedIds(row.related_ids);

      for (const entry of relatedIds) {
        const targetId = entry.id;

        // Both endpoints must exist in the filtered node set
        if (!nodeMap.has(targetId)) continue;

        const key = canonicalLinkKey(sourceId, targetId, entry.relation_type);
        if (seenLinks.has(key)) continue;

        // Canonical direction: lower ID is source
        const [canonSource, canonTarget] =
          sourceId < targetId
            ? [sourceId, targetId]
            : [targetId, sourceId];

        seenLinks.set(key, {
          source: canonSource,
          target: canonTarget,
          relation_type: entry.relation_type,
        });
      }
    }

    const links = [...seenLinks.values()];

    // --- Compute connectionCount per node ------------------------------------
    for (const link of links) {
      const sourceNode = nodeMap.get(link.source);
      const targetNode = nodeMap.get(link.target);
      if (sourceNode) sourceNode.connectionCount++;
      if (targetNode) targetNode.connectionCount++;
    }

    const response: GraphResponse = {
      nodes: [...nodeMap.values()],
      links,
      truncated,
      totalMemories,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
