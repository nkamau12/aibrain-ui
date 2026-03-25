/**
 * Core data types mirroring aibrain-mcp's LanceDB data model.
 *
 * Important: `content` is only populated when `includeContent: true` is
 * passed to the API. Components should rely on `summary` for list views;
 * only MemoryDetail (Phase 4) fetches full content via /api/memories/:id.
 */

// ---------------------------------------------------------------------------
// Relation types
// ---------------------------------------------------------------------------

/** A typed link between two memories — mirrors aibrain-mcp's RelatedId shape */
export interface RelatedId {
  id: string;
  relation_type: 'supersedes' | 'caused-by' | 'follow-up' | 'see-also' | 'similar';
}

/**
 * Lightweight summary of a related memory returned by search results when
 * `include_related: true` is passed. Full content is NOT included here —
 * fetch /api/memories/:id to get the full node.
 */
export interface RelatedMemorySummary {
  id: string;
  summary: string;
  relation_type: RelatedId['relation_type'];
  depth: number;
}

// ---------------------------------------------------------------------------
// Core memory shapes
// ---------------------------------------------------------------------------

export interface Memory {
  id: string;
  /** Full memory content — only present when includeContent: true was requested */
  content?: string;
  summary: string;
  tags: string[];
  agentName: string;
  sessionId: string;
  projectPath: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  /** Subsystem or domain scope — e.g. "auth-system", "payment-flow" */
  cluster?: string;
  /** Outbound links to related memories, including the relation type */
  related_ids?: RelatedId[];
  /** True when this memory has been superseded by a newer one */
  is_stale?: boolean;
}

/** Extends Memory with a relevance score returned by hybrid/vector search */
export interface MemorySearchResult extends Memory {
  score?: number;
  /** Populated when include_related: true is passed to the search endpoint */
  related?: RelatedMemorySummary[];
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface StatsResponse {
  totalMemories: number;
  memoriesThisWeek: number;
  topProject: { path: string; count: number };
  topAgent: { name: string; count: number };
  topTags: TagCount[];
  projects: Array<{ path: string; count: number }>;
  agents: Array<{ name: string; count: number }>;
}

export interface TimelinePoint {
  date: string;
  count: number;
}

/**
 * Filter parameters shared across recent-memories and search endpoints.
 * All fields are optional — omitting a field means "no filter on that dimension".
 */
export interface SearchFilters {
  projectPath?: string;
  agentName?: string;
  tags?: string[];
  /** ISO 8601 date string — include memories created on or after this date */
  since?: string;
  /** ISO 8601 date string — include memories created on or before this date */
  until?: string;
  /** Restrict results to a specific cluster (subsystem scope) */
  cluster?: string;
  /** When true, include memories that have been superseded */
  includeStale?: boolean;
}

/**
 * Options that control how the search service resolves and expands results.
 * These are NOT filter predicates — they affect what data is returned, not
 * which memories match.
 */
export interface SearchOptions {
  /** Expand each result with linked related memories */
  include_related?: boolean;
  /** How many hops to follow when resolving related memories (1 or 2) */
  related_depth?: 1 | 2;
  /** Include memories that have been superseded by a newer one */
  include_stale?: boolean;
}

export interface SearchRequest {
  query: string;
  limit?: number;
  /** Retrieval strategy — defaults to "hybrid" on the server */
  searchMode?: 'hybrid' | 'fulltext' | 'vector';
  filters?: SearchFilters;
  /** Whether to include the full content field in results */
  includeContent?: boolean;
  /** Truncation limit for content when includeContent is true (0 = unlimited) */
  contentMaxLength?: number;
}

// ---------------------------------------------------------------------------
// Brain graph types
// ---------------------------------------------------------------------------

/**
 * A node in the brain graph. `connectionCount` is computed server-side as
 * the sum of outbound (related_ids) and inbound references.
 */
export interface GraphNode {
  id: string;
  summary: string;
  cluster?: string;
  tags: string[];
  createdAt: string;
  projectPath: string;
  /** Total number of edges (both directions) touching this node */
  connectionCount: number;
}

/** A directed edge between two graph nodes */
export interface GraphLink {
  source: string;
  target: string;
  /** Reuses RelatedId.relation_type so union stays in one place */
  relation_type: RelatedId['relation_type'];
}

/** Full graph payload returned by GET /api/graph */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  /**
   * True when the server capped the result set — the graph shown is a
   * representative sample, not the full dataset.
   */
  truncated: boolean;
  /** Total number of memories in the backing store before any limit was applied */
  totalMemories: number;
}
