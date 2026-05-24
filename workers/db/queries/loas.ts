import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { customers, loas } from "../schema";
import { withTenantContext } from "../with-tenant-context";

// Sentinel error thrown by create/update when the supplied `customerId` is
// either missing OR belongs to a different tenant. Postgres FK checks bypass
// RLS (they run with table-owner privileges), so the FK alone would happily
// link a tenant-A LOA to a tenant-B customer. Route layer maps this to
// `400 VALIDATION {customerId: "unknown"}` — same response shape as a truly
// unknown id, so the answer doesn't leak whether the row exists for another
// tenant.
export class UnknownCustomerError extends Error {
  constructor() {
    super("UnknownCustomerError: customer not found in tenant");
    this.name = "UnknownCustomerError";
  }
}

export interface LoaListItem {
  id: string;
  customerId: string;
  pdfStoragePath: string | null;
  signedDate: string | null;
  expirationDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoaListPage {
  items: LoaListItem[];
  nextCursor: string | null;
}

interface Cursor {
  createdAt: string;
  id: string;
}

// TODO: consolidate `Cursor` + encode/decode with the identical pair in
// `customers.ts` once the rest of the domain-table query files land. Each
// resource currently duplicates this block — fine for an initial parallel
// rollout, worth a shared `_cursor.ts` once 3+ tables follow the same shape.
function encodeCursor(c: Cursor): string {
  return btoa(JSON.stringify(c));
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(atob(raw)) as Partial<Cursor>;
    if (typeof parsed.createdAt !== "string") return null;
    if (typeof parsed.id !== "string") return null;
    // Validate the timestamp is parseable so a malformed cursor doesn't
    // produce a `NaN` comparison that silently returns the whole table.
    if (Number.isNaN(Date.parse(parsed.createdAt))) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

const COLUMNS = {
  id: loas.id,
  customerId: loas.customerId,
  pdfStoragePath: loas.pdfStoragePath,
  signedDate: loas.signedDate,
  expirationDate: loas.expirationDate,
  createdAt: loas.createdAt,
  updatedAt: loas.updatedAt,
} as const;

export async function listLoas(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null; customerId?: string },
): Promise<LoaListPage> {
  // Composite tiebreak: (created_at desc, id desc). Without `id` in the cursor
  // simultaneous timestamps would skip rows or return duplicates across pages.
  //
  // Explicit `tenant_id = ?` predicate is defense in depth against RLS gaps
  // (wrong role connecting via Hyperdrive, policy misconfig, future schema
  // change). Same rationale for `customer_id` predicate when filtering.
  return withTenantContext(db, tenantId, async (tx) => {
    const tenantPredicate = eq(loas.tenantId, tenantId);
    const customerPredicate = opts.customerId
      ? eq(loas.customerId, opts.customerId)
      : undefined;
    const cursorPredicate = opts.cursor
      ? or(
          lt(loas.createdAt, new Date(opts.cursor.createdAt)),
          and(
            eq(loas.createdAt, new Date(opts.cursor.createdAt)),
            lt(loas.id, opts.cursor.id),
          ),
        )
      : undefined;

    const where = and(tenantPredicate, customerPredicate, cursorPredicate);

    const rows = await tx
      .select(COLUMNS)
      .from(loas)
      .where(where)
      .orderBy(desc(loas.createdAt), desc(loas.id))
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

export async function getLoaById(
  db: Db,
  tenantId: string,
  loaId: string,
): Promise<LoaListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(loas)
      .where(and(eq(loas.tenantId, tenantId), eq(loas.id, loaId)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export interface CreateLoaInput {
  customerId: string;
  pdfStoragePath?: string | null;
  signedDate?: string | null;
  expirationDate?: string | null;
}

async function assertCustomerInTenant(
  tx: Db,
  tenantId: string,
  customerId: string,
): Promise<void> {
  // RLS-scoped SELECT — if the customer belongs to another tenant the row
  // is invisible and we throw the same `UnknownCustomerError` we'd throw for
  // a missing UUID.
  const rows = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  if (rows.length === 0) throw new UnknownCustomerError();
}

export async function createLoa(
  db: Db,
  tenantId: string,
  input: CreateLoaInput,
): Promise<LoaListItem> {
  return withTenantContext(db, tenantId, async (tx) => {
    // FK alone wouldn't catch a cross-tenant customerId (Postgres FK checks
    // bypass RLS). Verify ownership inside the same transaction so the check
    // and the INSERT can't be interleaved.
    await assertCustomerInTenant(tx, tenantId, input.customerId);

    // tenantId forced from arg, not from caller input — RLS would block a
    // wrong-tenant value anyway, but the explicit assignment is the policy
    // boundary inside the worker.
    const rows = await tx
      .insert(loas)
      .values({
        tenantId,
        customerId: input.customerId,
        pdfStoragePath: input.pdfStoragePath ?? null,
        signedDate: input.signedDate ?? null,
        expirationDate: input.expirationDate ?? null,
      })
      .returning(COLUMNS);
    const row = rows[0];
    if (!row) throw new Error("createLoa: INSERT returned no row");
    return row;
  });
}

export interface UpdateLoaInput {
  customerId?: string;
  pdfStoragePath?: string | null;
  signedDate?: string | null;
  expirationDate?: string | null;
}

export async function updateLoa(
  db: Db,
  tenantId: string,
  loaId: string,
  patch: UpdateLoaInput,
): Promise<LoaListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    // Same cross-tenant defense as createLoa — if caller is reparenting the
    // LOA to a different customer, that customer must belong to this tenant.
    if (patch.customerId !== undefined) {
      await assertCustomerInTenant(tx, tenantId, patch.customerId);
    }

    // Build a partial set so callers can clear nullable columns by passing
    // null explicitly. Empty patch (no defined keys) returns the current row
    // unchanged — the UPDATE with only updated_at bump is safe and idempotent.
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.customerId !== undefined) set.customerId = patch.customerId;
    if (patch.pdfStoragePath !== undefined) set.pdfStoragePath = patch.pdfStoragePath;
    if (patch.signedDate !== undefined) set.signedDate = patch.signedDate;
    if (patch.expirationDate !== undefined) set.expirationDate = patch.expirationDate;

    const rows = await tx
      .update(loas)
      .set(set)
      .where(and(eq(loas.tenantId, tenantId), eq(loas.id, loaId)))
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteLoa(
  db: Db,
  tenantId: string,
  loaId: string,
): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(loas)
      .where(and(eq(loas.tenantId, tenantId), eq(loas.id, loaId)))
      .returning({ id: loas.id });
    return rows.length > 0;
  });
}
