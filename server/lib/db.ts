import { getTable } from '../../../aibrain-mcp/src/db/init.js';

/**
 * Fetch all memory rows directly from LanceDB for aggregation.
 *
 * We bypass getRecentMemories() because its limit cap (100) would corrupt
 * aggregate counts for users with large memory stores.
 *
 * @param columns - Optional list of columns to project. When omitted, all
 *   columns are returned. Pass an explicit list (e.g. excluding `embedding`
 *   and `contentAndSummary`) to reduce I/O when full row data is not needed.
 */
export async function fetchAllRows(
  columns?: string[]
): Promise<Array<Record<string, unknown>>> {
  const table = await getTable();
  // LanceDB defaults to limit=10 without an explicit .limit() call
  let query = table.query().limit(1_000_000);
  if (columns && columns.length > 0) {
    query = query.select(columns);
  }
  return query.toArray() as Promise<Array<Record<string, unknown>>>;
}
