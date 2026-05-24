// Dedup helpers — address-key normalization + agent cache.
// service_addresses has no natural key, so we SELECT-before-INSERT keyed on a
// normalized address concat. agents has no natural key either; we cache by
// (tenant_id, name) across the whole run since they're sparse (~tens of
// distinct values across the whole xlsx).

import { and, eq, sql } from "drizzle-orm";
import { agents, serviceAddresses } from "../../workers/db/schema";
import type { TxLike } from "./load";
import type { TransformedRow } from "./types";

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9|]/g, "")
    .replace(/\s+/g, "");
}

export function addressKey(row: TransformedRow): string {
  const parts = [
    row.streetNo,
    row.streetName,
    row.addressLine1,
    row.addressLine2,
    row.city,
    row.state,
    row.zip,
  ];
  // All-null/empty → "" so load.ts short-circuit treats it as "no address" and
  // INSERTs a fresh row instead of dedup-collapsing every null-address row
  // into one. normalize() preserves `|` (kept by char class), so without this
  // guard the key would be "||||||" and two unrelated null-address rows would
  // match via findServiceAddressByKey.
  if (!parts.some(Boolean)) return "";
  return normalize(parts.join("|"));
}

export async function findServiceAddressByKey(
  tx: TxLike,
  tenantId: string,
  customerId: string,
  key: string,
): Promise<string | null> {
  // SQL normalize MUST mirror normalize() above: same char class, same upper.
  // Drift here = silent dedup misses (TS computes key X, SQL row stored as Y).
  const rows = await tx
    .select({ id: serviceAddresses.id })
    .from(serviceAddresses)
    .where(
      and(
        eq(serviceAddresses.tenantId, tenantId),
        eq(serviceAddresses.customerId, customerId),
        sql`regexp_replace(upper(concat_ws('|',
          coalesce(${serviceAddresses.streetNo}, ''),
          coalesce(${serviceAddresses.streetName}, ''),
          coalesce(${serviceAddresses.addressLine1}, ''),
          coalesce(${serviceAddresses.addressLine2}, ''),
          coalesce(${serviceAddresses.city}, ''),
          coalesce(${serviceAddresses.state}, ''),
          coalesce(${serviceAddresses.zip}, '')
        )), '[^A-Z0-9|]', '', 'g') = ${key}`,
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

// Whitespace + case normalize for agent name dedup. xlsx variants like
// "John Smith", "john smith", "John  Smith ", "JOHN SMITH" all collapse to a
// single canonical key. Display name (first-seen casing) preserved for INSERT.
export function normalizeAgentName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Two-stage cache for lazy agent creation.
 *
 * - `prewarm()` inserts missing agents BEFORE any row-loading work begins.
 *   Real-mode (`executor = db`): runs in its own committed transaction, so
 *   the cache is backed by durable rows by the time the bulk loader starts.
 *   Dry-run mode (`executor = outerTx`): nests as a SAVEPOINT inside the
 *   outer rollback-only tx — the agent INSERTs roll back with everything
 *   else, but the cache is still consistent within the single dry-run pass.
 *
 *   The original hazard this guards against (per-row INSERT inside a savepoint
 *   that could roll back and leave a stale UUID in the cache) is gone in the
 *   bulk loader: passes do not nest savepoints per row. Pre-warm is preserved
 *   because it cleanly separates "agent name resolution" from the main pass
 *   work and gives a deterministic point to count inserted/reused agents.
 *
 * - `get()` is a pure cache lookup with no DB I/O — safe to call from any
 *   pass without mutating state that could outlive a failed chunk.
 */
export class AgentCache {
  private byKey = new Map<string, string>(); // normalize(name) → id
  private _inserted = 0;
  private _reused = 0;

  get insertedCount(): number {
    return this._inserted;
  }
  get reusedCount(): number {
    return this._reused;
  }

  /** Insert any names not yet in DB inside one committed transaction. */
  async prewarm(executor: TxLike, tenantId: string, names: ReadonlySet<string>): Promise<void> {
    const keyToDisplay = new Map<string, string>();
    for (const raw of names) {
      const key = normalizeAgentName(raw);
      if (key === "") continue;
      if (!keyToDisplay.has(key)) keyToDisplay.set(key, raw.trim());
    }
    if (keyToDisplay.size === 0) return;

    await executor.transaction(async (tx) => {
      const existing = await tx
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(eq(agents.tenantId, tenantId));
      for (const row of existing) {
        const key = normalizeAgentName(row.name);
        if (keyToDisplay.has(key)) {
          this.byKey.set(key, row.id);
          this._reused++;
        }
      }

      for (const [key, display] of keyToDisplay) {
        if (this.byKey.has(key)) continue;
        const inserted = await tx
          .insert(agents)
          .values({ tenantId, name: display })
          .returning({ id: agents.id });
        if (!inserted[0]) throw new Error(`Failed to insert agent ${display}`);
        this.byKey.set(key, inserted[0].id);
        this._inserted++;
      }
    });
  }

  /** Pure in-memory lookup. Returns null if name wasn't pre-warmed. */
  get(name: string | null): string | null {
    if (!name) return null;
    const key = normalizeAgentName(name);
    if (key === "") return null;
    return this.byKey.get(key) ?? null;
  }
}
