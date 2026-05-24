import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { esis, serviceAddresses } from "../schema";
import { withTenantContext } from "../with-tenant-context";

// ESI ID = Electric Service Identifier (xlsx "Meter Number") — the canonical
// universal key in TX energy, tied to a service address. Physical Meter Serial
// (xlsx "Meter Id") is the device serial on the meter itself and changes on
// meter swap. The two are DISTINCT fields and must never be collapsed —
// supplier-invoice reconciliation depends on preserving both.
export interface EsiListItem {
  id: string;
  serviceAddressId: string;
  esiId: string;
  physicalMeterSerial: string | null;
  eacKwh: string | null;
  billingAqKwh: string | null;
  annualUsageKwh: string | null;
  createdAt: Date;
}

export interface EsiListPage {
  items: EsiListItem[];
  nextCursor: string | null;
}

interface Cursor {
  createdAt: string;
  id: string;
}

// base64url: plain base64 emits `+` and `/`, which corrupt when round-tripped
// through a URL query string (`+` decodes as space). Map to `-` / `_` and strip
// padding so the cursor is safe to copy into a `?cursor=` value as-is.
function encodeCursor(c: Cursor): string {
  return btoa(JSON.stringify(c))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const parsed = JSON.parse(atob(padded)) as Partial<Cursor>;
    if (typeof parsed.createdAt !== "string") return null;
    if (typeof parsed.id !== "string") return null;
    if (Number.isNaN(Date.parse(parsed.createdAt))) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

const COLUMNS = {
  id: esis.id,
  serviceAddressId: esis.serviceAddressId,
  esiId: esis.esiId,
  physicalMeterSerial: esis.physicalMeterSerial,
  eacKwh: esis.eacKwh,
  billingAqKwh: esis.billingAqKwh,
  annualUsageKwh: esis.annualUsageKwh,
  createdAt: esis.createdAt,
} as const;

export interface ListEsisOpts {
  limit: number;
  cursor: Cursor | null;
  serviceAddressId?: string;
}

export async function listEsis(db: Db, tenantId: string, opts: ListEsisOpts): Promise<EsiListPage> {
  // Composite tiebreak (createdAt desc, id desc) so simultaneous timestamps
  // don't skip rows or duplicate across pages.
  //
  // Explicit `tenant_id = ?` predicate is defense in depth against RLS gaps
  // (wrong role via Hyperdrive, policy regressions). It also lets the planner
  // use the composite index on `(tenant_id, id)` with a literal rather than
  // the opaque `auth.jwt() ->> 'tenant_id'` function call.
  return withTenantContext(db, tenantId, async (tx) => {
    const cursorPredicate = opts.cursor
      ? or(
          lt(esis.createdAt, new Date(opts.cursor.createdAt)),
          and(eq(esis.createdAt, new Date(opts.cursor.createdAt)), lt(esis.id, opts.cursor.id)),
        )
      : undefined;
    const where = and(
      eq(esis.tenantId, tenantId),
      opts.serviceAddressId ? eq(esis.serviceAddressId, opts.serviceAddressId) : undefined,
      cursorPredicate,
    );

    const rows = await tx
      .select(COLUMNS)
      .from(esis)
      .where(where)
      .orderBy(desc(esis.createdAt), desc(esis.id))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;

    return { items, nextCursor };
  });
}

export async function getEsiById(
  db: Db,
  tenantId: string,
  esiPkId: string,
): Promise<EsiListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(esis)
      .where(and(eq(esis.tenantId, tenantId), eq(esis.id, esiPkId)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export interface CreateEsiInput {
  serviceAddressId: string;
  esiId: string;
  physicalMeterSerial?: string | null;
  eacKwh?: string | null;
  billingAqKwh?: string | null;
  annualUsageKwh?: string | null;
}

export async function createEsi(
  db: Db,
  tenantId: string,
  input: CreateEsiInput,
): Promise<EsiListItem | null> {
  // `tenantId` always forced from the resolved request context, never from the
  // request body — defense in depth on top of RLS WITH CHECK.
  //
  // The serviceAddressId FK only blocks dangling references; it does NOT
  // enforce tenant isolation. A tenant-A caller could otherwise create an ESI
  // pointing at a tenant-B service_address row. Resolve ownership inside the
  // same tx (so RLS gates the SELECT) and return null on miss; the handler
  // maps that to 404 to avoid leaking cross-tenant address existence.
  return withTenantContext(db, tenantId, async (tx) => {
    const owner = await tx
      .select({ id: serviceAddresses.id })
      .from(serviceAddresses)
      .where(
        and(
          eq(serviceAddresses.tenantId, tenantId),
          eq(serviceAddresses.id, input.serviceAddressId),
        ),
      )
      .limit(1);
    if (owner.length === 0) return null;

    const rows = await tx
      .insert(esis)
      .values({
        tenantId,
        serviceAddressId: input.serviceAddressId,
        esiId: input.esiId,
        physicalMeterSerial: input.physicalMeterSerial ?? null,
        eacKwh: input.eacKwh ?? null,
        billingAqKwh: input.billingAqKwh ?? null,
        annualUsageKwh: input.annualUsageKwh ?? null,
      })
      .returning(COLUMNS);
    return rows[0]!;
  });
}

// PATCH input — `esiId` deliberately absent: the ESI ID is the canonical
// universal key in TX energy (per CLAUDE.md domain glossary). Treat it as
// immutable post-creation, same invariant as `tenantId`. A re-key needs a
// delete + insert, not an UPDATE.
export interface UpdateEsiInput {
  serviceAddressId?: string;
  physicalMeterSerial?: string | null;
  eacKwh?: string | null;
  billingAqKwh?: string | null;
  annualUsageKwh?: string | null;
}

export async function updateEsi(
  db: Db,
  tenantId: string,
  esiPkId: string,
  patch: UpdateEsiInput,
): Promise<EsiListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    // Empty patch (no fields supplied) — short-circuit to a plain read so we
    // don't issue an `UPDATE … SET WHERE` with nothing to set.
    if (Object.values(patch).every((v) => v === undefined)) {
      const rows = await tx
        .select(COLUMNS)
        .from(esis)
        .where(and(eq(esis.tenantId, tenantId), eq(esis.id, esiPkId)))
        .limit(1);
      return rows[0] ?? null;
    }

    // Re-parenting to a different service_address — verify it belongs to the
    // same tenant before applying the patch. See createEsi for the same
    // reasoning.
    if (patch.serviceAddressId !== undefined) {
      const owner = await tx
        .select({ id: serviceAddresses.id })
        .from(serviceAddresses)
        .where(
          and(
            eq(serviceAddresses.tenantId, tenantId),
            eq(serviceAddresses.id, patch.serviceAddressId),
          ),
        )
        .limit(1);
      if (owner.length === 0) return null;
    }

    const rows = await tx
      .update(esis)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(esis.tenantId, tenantId), eq(esis.id, esiPkId)))
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteEsi(db: Db, tenantId: string, esiPkId: string): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(esis)
      .where(and(eq(esis.tenantId, tenantId), eq(esis.id, esiPkId)))
      .returning({ id: esis.id });
    return rows.length > 0;
  });
}
