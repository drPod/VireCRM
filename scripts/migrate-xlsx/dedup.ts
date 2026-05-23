// Dedup helpers — address-key normalization + agent cache.
// service_addresses has no natural key, so we SELECT-before-INSERT keyed on a
// normalized address concat. agents has no natural key either; we cache by
// (tenant_id, name) across the whole run since they're sparse (~tens of
// distinct values across the whole xlsx).

import { and, eq, sql } from "drizzle-orm";
import { agents, serviceAddresses } from "../../workers/db/schema";
import type { TransformedRow } from "./types";
import type { TxLike } from "./load";

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.toUpperCase().replace(/[^A-Z0-9|]/g, "").replace(/\s+/g, "");
}

export function addressKey(row: TransformedRow): string {
  return normalize(
    [
      row.streetNo,
      row.streetName,
      row.addressLine1,
      row.addressLine2,
      row.city,
      row.state,
      row.zip,
    ].join("|"),
  );
}

export async function findServiceAddressByKey(
  tx: TxLike,
  tenantId: string,
  customerId: string,
  key: string,
): Promise<string | null> {
  // We don't store the normalized key on the table (would require a schema
  // change to a Phase-2-only concern). Postgres applies the same normalize in
  // the WHERE clause — replicates the TS regex via translate + upper.
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
 * - `prewarm()` runs in its own committed transaction BEFORE any per-row work.
 *   It scans every TransformedRow for distinct agent names, inserts the
 *   missing ones, and populates the cache. This is critical for correctness:
 *   `getOrCreate` used to INSERT inside the per-row savepoint, and any row
 *   that failed AFTER the agent INSERT would leave a stale UUID in the cache
 *   pointing at a rolled-back row. The next row referencing that agent would
 *   then hit a foreign-key violation. Pre-warming with a separate committed
 *   tx removes that hazard.
 *
 * - `get()` is a pure cache lookup with no DB I/O — safe to call from inside
 *   per-row savepoints because it never mutates state that could outlive a
 *   failed row.
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
  async prewarm(
    executor: TxLike,
    tenantId: string,
    names: ReadonlySet<string>,
  ): Promise<void> {
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
