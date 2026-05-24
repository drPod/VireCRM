import { and, desc, eq, lt, or, type SQLWrapper } from "drizzle-orm";
import type { Db } from "../index";
import { aggregatorPayouts } from "../schema";
import { withTenantContext } from "../with-tenant-context";

export interface AggregatorPayoutRow {
  id: string;
  contractId: string;
  aggregatorName: string;
  aggregatorCommPct: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  amount: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AggregatorPayoutListPage {
  items: AggregatorPayoutRow[];
  nextCursor: string | null;
}

interface Cursor {
  createdAt: string;
  id: string;
}

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
  id: aggregatorPayouts.id,
  contractId: aggregatorPayouts.contractId,
  aggregatorName: aggregatorPayouts.aggregatorName,
  aggregatorCommPct: aggregatorPayouts.aggregatorCommPct,
  periodStart: aggregatorPayouts.periodStart,
  periodEnd: aggregatorPayouts.periodEnd,
  amount: aggregatorPayouts.amount,
  createdAt: aggregatorPayouts.createdAt,
  updatedAt: aggregatorPayouts.updatedAt,
} as const;

export interface ListAggregatorPayoutsOpts {
  limit: number;
  cursor: Cursor | null;
  contractId?: string;
  aggregatorName?: string;
}

export async function listAggregatorPayouts(
  db: Db,
  tenantId: string,
  opts: ListAggregatorPayoutsOpts,
): Promise<AggregatorPayoutListPage> {
  // Composite tiebreak: (created_at desc, id desc). Without `id` in the cursor
  // simultaneous timestamps would skip rows or return duplicates across pages.
  //
  // Explicit `tenant_id = ?` predicate is defense in depth against RLS gaps
  // (wrong role connecting via Hyperdrive, policy misconfig, future schema
  // change). It also lets the planner use the composite index with a literal
  // rather than the `auth.jwt()->>tenant_id` function call from RLS.
  return withTenantContext(db, tenantId, async (tx) => {
    const predicates: SQLWrapper[] = [eq(aggregatorPayouts.tenantId, tenantId)];
    if (opts.contractId) {
      predicates.push(eq(aggregatorPayouts.contractId, opts.contractId));
    }
    if (opts.aggregatorName) {
      predicates.push(eq(aggregatorPayouts.aggregatorName, opts.aggregatorName));
    }
    if (opts.cursor) {
      const cursorCreatedAt = new Date(opts.cursor.createdAt);
      predicates.push(
        or(
          lt(aggregatorPayouts.createdAt, cursorCreatedAt),
          and(
            eq(aggregatorPayouts.createdAt, cursorCreatedAt),
            lt(aggregatorPayouts.id, opts.cursor.id),
          ),
        )!,
      );
    }

    const rows = await tx
      .select(COLUMNS)
      .from(aggregatorPayouts)
      .where(and(...predicates))
      .orderBy(desc(aggregatorPayouts.createdAt), desc(aggregatorPayouts.id))
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

export async function getAggregatorPayoutById(
  db: Db,
  tenantId: string,
  payoutId: string,
): Promise<AggregatorPayoutRow | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(aggregatorPayouts)
      .where(
        and(
          eq(aggregatorPayouts.tenantId, tenantId),
          eq(aggregatorPayouts.id, payoutId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export interface CreateAggregatorPayoutInput {
  contractId: string;
  aggregatorName: string;
  aggregatorCommPct?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  amount?: string | null;
}

export async function createAggregatorPayout(
  db: Db,
  tenantId: string,
  input: CreateAggregatorPayoutInput,
): Promise<AggregatorPayoutRow> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .insert(aggregatorPayouts)
      .values({
        // tenantId forced from the authenticated context, never from the body.
        tenantId,
        contractId: input.contractId,
        aggregatorName: input.aggregatorName,
        aggregatorCommPct: input.aggregatorCommPct ?? null,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        amount: input.amount ?? null,
      })
      .returning(COLUMNS);
    // INSERT … RETURNING with non-empty VALUES always returns the row.
    return rows[0]!;
  });
}

export interface UpdateAggregatorPayoutInput {
  contractId?: string;
  aggregatorName?: string;
  aggregatorCommPct?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  amount?: string | null;
}

export async function updateAggregatorPayout(
  db: Db,
  tenantId: string,
  payoutId: string,
  input: UpdateAggregatorPayoutInput,
): Promise<AggregatorPayoutRow | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.contractId !== undefined) patch.contractId = input.contractId;
    if (input.aggregatorName !== undefined) patch.aggregatorName = input.aggregatorName;
    if (input.aggregatorCommPct !== undefined) patch.aggregatorCommPct = input.aggregatorCommPct;
    if (input.periodStart !== undefined) patch.periodStart = input.periodStart;
    if (input.periodEnd !== undefined) patch.periodEnd = input.periodEnd;
    if (input.amount !== undefined) patch.amount = input.amount;

    const rows = await tx
      .update(aggregatorPayouts)
      .set(patch)
      .where(
        and(
          eq(aggregatorPayouts.tenantId, tenantId),
          eq(aggregatorPayouts.id, payoutId),
        ),
      )
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteAggregatorPayout(
  db: Db,
  tenantId: string,
  payoutId: string,
): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(aggregatorPayouts)
      .where(
        and(
          eq(aggregatorPayouts.tenantId, tenantId),
          eq(aggregatorPayouts.id, payoutId),
        ),
      )
      .returning({ id: aggregatorPayouts.id });
    return rows.length > 0;
  });
}
