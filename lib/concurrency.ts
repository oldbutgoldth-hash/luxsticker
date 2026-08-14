/**
 * Bounded-concurrency worker pool (spec Phase 3 §25 — "ห้ามยิง API 40
 * Request พร้อมกันโดยไม่มีการควบคุม ... Concurrency Limit เช่น 2-4 requests").
 * Generic and dependency-free so it's trivially unit-testable in plain Node
 * (no DOM/network needed — see TESTING.md Phase 3, "Queue / Concurrency
 * Limit"): a synchronous counter tracking how many `worker` calls are
 * in-flight at once, asserted to never exceed `limit`.
 *
 * Runs `worker` for every item in `items`, at most `limit` at a time, and
 * resolves with results in the SAME ORDER as `items` regardless of which
 * one actually finished first — callers that need to report "sticker #N
 * finished" don't have to reconstruct ordering themselves.
 */
export async function runWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const boundedLimit = Math.max(1, Math.min(limit, items.length || 1));
  let nextIndex = 0;

  async function runLane(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }

  const lanes = Array.from({ length: boundedLimit }, () => runLane());
  await Promise.all(lanes);
  return results;
}

/** Spec §25's suggested range is 2-4; 3 is the middle of that range and is
 * this app's default for AI Expression batch generation specifically (not
 * for the local, CPU-bound canvas render pipeline — that stays fully
 * sequential per spec §1's "don't rebuild" and Phase 2's original memory
 * reasoning, unaffected by this constant). */
export const DEFAULT_AI_CONCURRENCY = 3;
