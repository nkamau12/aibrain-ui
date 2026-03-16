/**
 * Core data types mirroring aibrain-mcp's LanceDB data model.
 *
 * Important: `content` is only populated when `includeContent: true` is
 * passed to the API. Components should rely on `summary` for list views;
 * only MemoryDetail (Phase 4) fetches full content via /api/memories/:id.
 */

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
}

/** Extends Memory with a relevance score returned by hybrid/vector search */
export interface MemorySearchResult extends Memory {
  score?: number;
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
