// Two-tier read-through cache: per-isolate LRU (hot path) + KV (cold isolate).
//
// - LRU: 10s TTL, 256-entry cap. Map iteration order = LRU order; on
//   access/insert we delete+re-set to move to the tail.
// - KV: 60s TTL. CF KV minimum is `expirationTtl >= 60`; shorter is rejected
//   by the platform regardless of what CLAUDE.md says.
// - Only `get(key, loader)` and `invalidate(key)`. To honor the
//   "read-through-after-write" invariant, writers call `invalidate(key)`
//   after the DB mutation; the next read re-populates from the loader.
// - No single-flight: concurrent misses for the same key both run the loader.
//   Acceptable for low-cardinality tenant lookups; revisit if a loader is
//   expensive enough to need coalescing.

const LRU_CAP = 256;
const LRU_TTL_MS = 10_000;
const KV_TTL_S = 60;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

// Module-scoped per-isolate cache. Map preserves insertion order; we treat
// it as an LRU by deleting + re-inserting on access.
const lru = new Map<string, Entry<unknown>>();

function lruGet<T>(key: string): T | undefined {
  const entry = lru.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    lru.delete(key);
    return undefined;
  }
  // Touch: re-insert at the tail (most-recently used).
  lru.delete(key);
  lru.set(key, entry);
  return entry.value;
}

function lruSet<T>(key: string, value: T): void {
  lru.delete(key);
  lru.set(key, { value, expiresAt: Date.now() + LRU_TTL_MS });
  while (lru.size > LRU_CAP) {
    const oldest = lru.keys().next().value;
    if (oldest === undefined) break;
    lru.delete(oldest);
  }
}

export interface Cache {
  get<T>(key: string, loader: () => Promise<T>): Promise<T>;
  invalidate(key: string): void;
}

// `ctx` is structurally typed to the `waitUntil` slot only. Avoids the
// mismatch between CF Workers' `ExecutionContext<Props>` (with required
// `exports`) and Hono's narrower `ExecutionContext` returned by
// `c.executionCtx`. Both satisfy this shape.
type WaitUntil = { waitUntil: (promise: Promise<unknown>) => void };

export function makeCache(kv: KVNamespace, ctx: WaitUntil): Cache {
  return {
    async get<T>(key: string, loader: () => Promise<T>): Promise<T> {
      const hot = lruGet<T>(key);
      if (hot !== undefined) return hot;

      const cold = await kv.get<T>(key, "json");
      if (cold !== null) {
        lruSet(key, cold);
        return cold;
      }

      const fresh = await loader();
      lruSet(key, fresh);
      ctx.waitUntil(kv.put(key, JSON.stringify(fresh), { expirationTtl: KV_TTL_S }));
      return fresh;
    },

    invalidate(key: string) {
      lru.delete(key);
      ctx.waitUntil(kv.delete(key));
    },
  };
}
