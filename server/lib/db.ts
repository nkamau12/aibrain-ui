import { getTable } from '../../../aibrain-mcp/src/db/init.js';

/**
 * Fetch all memory rows directly from LanceDB.
 *
 * We bypass getRecentMemories() / getTable().query() defaults because
 * LanceDB's default limit is 10, and service-layer helpers cap at 100 —
 * both would silently truncate aggregate queries on large memory stores.
 *
 * @param columns Optional list of column names to select. When provided,
 *   LanceDB performs a server-side projection, which is important for
 *   excluding heavy columns like `embedding` (float[]) and `contentAndSummary`
 *   that are not needed for most aggregation and graph-building workloads.
 */
export async function fetchAllRows(
  columns?: string[],
): Promise<Array<Record<string, unknown>>> {
  const table = await getTable();
  const query = table.query().limit(1_000_000);

  if (columns && columns.length > 0) {
    query.select(columns);
  }

  return query.toArray() as Promise<Array<Record<string, unknown>>>;
}
