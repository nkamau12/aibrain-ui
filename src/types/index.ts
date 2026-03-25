/**
 * Central re-export point for all shared TypeScript types.
 * Import from '@/types' rather than from individual type files.
 */
export type {
  Memory,
  MemorySearchResult,
  TagCount,
  StatsResponse,
  TimelinePoint,
  SearchFilters,
  SearchRequest,
  // New types added for brain graph + related/stale support
  RelatedId,
  RelatedMemorySummary,
  SearchOptions,
  GraphNode,
  GraphLink,
  GraphData,
} from './memory';
