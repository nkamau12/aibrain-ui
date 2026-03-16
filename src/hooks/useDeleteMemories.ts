import { useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Memory } from '@/types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BatchDeleteState {
  status: 'idle' | 'deleting' | 'done' | 'error'
  progress: number
  total: number
  failures: Array<{ id: string; error: string }>
  deletedIds: string[]
}

export interface UseDeleteMemoriesReturn {
  state: BatchDeleteState
  deleteMemories: (ids: string[]) => Promise<void>
  retryFailed: () => Promise<void>
  reset: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IDLE_STATE: BatchDeleteState = {
  status: 'idle',
  progress: 0,
  total: 0,
  failures: [],
  deletedIds: [],
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages a batch delete operation against the memories API.
 *
 * Deletions run sequentially (not concurrently) so the caller gets meaningful
 * incremental progress and per-item error granularity without racing.
 *
 * Optimistic cache removal happens before the first network call so the UI
 * feels instant; caches are reconciled on completion regardless of outcome.
 */
export function useDeleteMemories(): UseDeleteMemoriesReturn {
  const queryClient = useQueryClient()
  const [state, setState] = useState<BatchDeleteState>(IDLE_STATE)

  // Allows the caller to abort a running operation between iterations.
  // We use a ref (not state) because mutation doesn't need to trigger a render.
  const abortedRef = useRef(false)

  // ---------------------------------------------------------------------------
  // Core deletion loop — extracted so both deleteMemories and retryFailed share it
  // ---------------------------------------------------------------------------

  const runDeletions = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return

      abortedRef.current = false

      // Snapshot both cache families for partial-failure recovery
      const previousRecent = queryClient.getQueriesData({ queryKey: ['memories', 'recent'] })
      const previousSearch = queryClient.getQueriesData({ queryKey: ['memories', 'search'] })

      // Cancel in-flight queries so they don't race with our optimistic writes
      await queryClient.cancelQueries({ queryKey: ['memories', 'recent'] })
      await queryClient.cancelQueries({ queryKey: ['memories', 'search'] })

      // Optimistically remove ALL target IDs from list caches before the loop.
      // This makes the UI feel instant even though the loop runs sequentially.
      const idSet = new Set(ids)

      queryClient.setQueriesData(
        { queryKey: ['memories', 'recent'] },
        (old: { memories: Memory[]; total: number } | undefined) => {
          if (!old) return old
          const filtered = old.memories.filter((m) => !idSet.has(m.id))
          return { ...old, memories: filtered, total: filtered.length }
        },
      )

      queryClient.setQueriesData(
        { queryKey: ['memories', 'search'] },
        (old: { results: Memory[]; totalFound: number; searchMode: string } | undefined) => {
          if (!old) return old
          const filtered = old.results.filter((m) => !idSet.has(m.id))
          return { ...old, results: filtered, totalFound: filtered.length }
        },
      )

      setState({
        status: 'deleting',
        progress: 0,
        total: ids.length,
        failures: [],
        deletedIds: [],
      })

      const failures: Array<{ id: string; error: string }> = []
      const deletedIds: string[] = []

      for (const id of ids) {
        if (abortedRef.current) break

        try {
          await apiFetch<void>(`/api/memories/${id}`, { method: 'DELETE' })
          deletedIds.push(id)
        } catch (err) {
          failures.push({
            id,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }

        // Increment progress after each attempt (success or failure)
        setState((prev) => ({ ...prev, progress: prev.progress + 1 }))
      }

      const finalStatus = failures.length === 0 ? 'done' : 'error'

      setState((prev) => ({
        ...prev,
        status: finalStatus,
        failures,
        deletedIds,
      }))

      if (finalStatus === 'done') {
        // Full success: remove individual detail caches for deleted IDs and
        // trigger a server re-fetch for both list families.
        for (const id of deletedIds) {
          queryClient.removeQueries({ queryKey: ['memories', id] })
        }
        await queryClient.invalidateQueries({ queryKey: ['memories', 'recent'] })
        await queryClient.invalidateQueries({ queryKey: ['memories', 'search'] })
      } else {
        // Partial failure: invalidate so successfully-deleted items disappear
        // from the server response while failed items reappear.
        //
        // We do NOT roll back the optimistic state — instead we let the server
        // re-fetch produce the authoritative list. This avoids a flash where
        // already-deleted items temporarily reappear only to vanish again.
        await queryClient.invalidateQueries({ queryKey: ['memories', 'recent'] })
        await queryClient.invalidateQueries({ queryKey: ['memories', 'search'] })

        // Suppress unused-variable warnings — these were snapshotted for rollback
        // but the invalidation strategy above is preferable for partial failures.
        void previousRecent
        void previousSearch
      }
    },
    [queryClient],
  )

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  const deleteMemories = useCallback(
    async (ids: string[]) => {
      await runDeletions(ids)
    },
    [runDeletions],
  )

  /**
   * Re-runs the deletion loop using only the IDs from the previous run's
   * failures. Callers should only invoke this when status === 'error'.
   */
  const retryFailed = useCallback(async () => {
    const failedIds = state.failures.map((f) => f.id)
    if (failedIds.length === 0) return
    await runDeletions(failedIds)
  }, [state.failures, runDeletions])

  /**
   * Returns all state to idle defaults without triggering any network calls.
   * Safe to call at any time, including mid-deletion (the abort flag will
   * cause the loop to exit after the current in-flight request completes).
   */
  const reset = useCallback(() => {
    abortedRef.current = true
    setState(IDLE_STATE)
  }, [])

  return { state, deleteMemories, retryFailed, reset }
}
