/**
 * Core data types mirroring aibrain-mcp's LanceDB data model.
 *
 * Important: `content` is only populated when `includeContent: true` is
 * passed to the API. Components should rely on `summary` for list views;
 * only MemoryDetail (Phase 4) fetches full content via /api/memories/:id.
 */

/**
 * Represents a directed relationship from one memory to another.
 * Mirrors the related_ids field stored in aibrain-mcp.
 */
export interface RelatedId {
  id: string;
  relation_type: 'supersedes' | 'caused-by' | 'see-also' | 'follow-up' | 'similar';
}

/**
 * A lightweight summary of a related memory returned when
 * include_related is true on search or get_related_memories calls.
 */
export interface RelatedMemorySummary {
  id: string;
  summary: string;
  relation_type: RelatedId['relation_type'];
  depth: number;
  is_stale?: boolean;
}

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
  /** Logical grouping / subsystem scope for this memory */
  cluster?: string;
  /** Directed relationships to other memories */
  related_ids?: RelatedId[];
  /** True when this memory has been superseded by a newer one */
  is_stale?: boolean;
}

/** Extends Memory with a relevance score returned by hybrid/vector search */
export interface MemorySearchResult extends Memory {
  score?: number;
  /** Related memory summaries — only present when include_related: true */
  related?: RelatedMemorySummary[];
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface ClusterCount {
  name: string;
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
  /** Cluster distribution sorted by count descending. Memories with no cluster are grouped as "unclustered". */
  clusters: ClusterCount[];
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
  /** Scope results to a specific cluster / subsystem */
  cluster?: string;
  /** When true, include memories that have been superseded */
  includeStale?: boolean;
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

/**
 * Additional options controlling relationship traversal and stale inclusion
 * on search and get_related_memories calls.
 */
export interface SearchOptions {
  /** Attach related memory summaries to each result */
  include_related?: boolean;
  /** How many relationship hops to follow (1 or 2) */
  related_depth?: number;
  /** Include superseded (stale) memories in results */
  include_stale?: boolean;
}

// ---------------------------------------------------------------------------
// Graph visualisation types
// ---------------------------------------------------------------------------

/**
 * A single node in the memory relationship graph.
 * connectionCount is computed server-side from the length of related_ids
 * plus inbound references — used to size nodes in the visualisation.
 */
export interface GraphNode {
  id: string;
  summary: string;
  cluster?: string;
  tags?: string[];
  projectPath?: string;
  agentName?: string;
  createdAt: string;
  is_stale?: boolean;
  connectionCount: number;
}

/** A directed edge between two graph nodes */
export interface GraphLink {
  source: string;
  target: string;
  relation_type: RelatedId['relation_type'];
}

/**
 * Full graph payload returned by /api/graph.
 * `truncated` is true when the node set was capped to avoid browser overload;
 * `totalMemories` reflects the untruncated count so the UI can show a warning.
 */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  truncated: boolean;
  totalMemories: number;
}
