import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { esis, serviceAddresses } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { type Cursor, decodeCursor, encodeCursor } from "./_cursor";

// Re-exported so the route layer keeps its single import surface.
export { decodeCursor };

// NAMING: `id` is the row UUID (what `contracts.esiId` references);
// `esiId` is the canonical 17–22-digit ERCOT Electric Service Identifier.
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

export interface EsiFilters {
  serviceAddressId?: string;
  customerId?: string;
}

export async function listEsis(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null; filters?: EsiFilters },
): Promise<EsiListPage> {
  // Keyset pagination on (created_at desc, id desc). The `customerId` filter
  // resolves through service_addresses (same pattern as the contracts query's
  // customer filter) so callers can list every meter a customer owns without
  // first walking addresses. Explicit `tenant_id` predicates are defense in
  // depth (matching RLS) on both the main query and the subquery.
  return withTenantContext(db, tenantId, async (tx) => {
    const { serviceAddressId, customerId } = opts.filters ?? {};

    const customerAddressSubquery =
      customerId !== undefined
        ? tx
            .select({ id: serviceAddresses.id })
            .from(serviceAddresses)
            .where(
              and(
                eq(serviceAddresses.tenantId, tenantId),
                eq(serviceAddresses.customerId, customerId),
              ),
            )
        : undefined;

    const cursorPredicate = opts.cursor
      ? or(
          lt(esis.createdAt, new Date(opts.cursor.createdAt)),
          and(
            eq(esis.createdAt, new Date(opts.cursor.createdAt)),
            lt(esis.id, opts.cursor.id),
          ),
        )
      : undefined;
    const where = and(
      eq(esis.tenantId, tenantId),
      serviceAddressId !== undefined
        ? eq(esis.serviceAddressId, serviceAddressId)
        : undefined,
      customerAddressSubquery !== undefined
        ? inArray(esis.serviceAddressId, customerAddressSubquery)
        : undefined,
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
  esiRowId: string,
): Promise<EsiListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(esis)
      .where(and(eq(esis.tenantId, tenantId), eq(esis.id, esiRowId)))
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
  // FK checks bypass RLS, so verify serviceAddress ownership in-tx first;
  // null on miss (handler answers 400 without leaking existence).
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

// esiId absent: immutable post-creation (canonical key per glossary).
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
  esiRowId: string,
  patch: UpdateEsiInput,
): Promise<EsiListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    // Empty patch: plain read (avoids `UPDATE … SET WHERE` with nothing to set).
    if (Object.values(patch).every((v) => v === undefined)) {
      const rows = await tx
        .select(COLUMNS)
        .from(esis)
        .where(and(eq(esis.tenantId, tenantId), eq(esis.id, esiRowId)))
        .limit(1);
      return rows[0] ?? null;
    }

    // Re-parent target must belong to the same tenant (see createEsi).
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
      .where(and(eq(esis.tenantId, tenantId), eq(esis.id, esiRowId)))
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteEsi(db: Db, tenantId: string, esiRowId: string): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(esis)
      .where(and(eq(esis.tenantId, tenantId), eq(esis.id, esiRowId)))
      .returning({ id: esis.id });
    return rows.length > 0;
  });
}
