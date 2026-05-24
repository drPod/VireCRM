import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { contracts, esis, serviceAddresses } from "../schema";
import { withTenantContext } from "../with-tenant-context";

// `contracts.gross_tcv`, `contracts.net_tcv`, `contracts.net_aq` are
// `GENERATED ALWAYS AS (...) STORED` Postgres columns — they must NOT appear in
// INSERT/UPDATE payloads (driver throws), but ARE included in SELECT shapes so
// callers see the computed TCV without recomputing in TS.
export interface ContractRow {
  id: string;
  tenantId: string;
  esiId: string;
  externalSaleId: string | null;
  supplier: string | null;
  supplyType: string | null;
  startDate: string | null;
  endDate: string | null;
  costPerKwh: string | null;
  agentMils: string | null;
  currency: string;
  fxRate: string;
  pipelineStatus: string;
  isLive: boolean;
  saleType: string | null;
  lostDate: string | null;
  lostReason: string | null;
  lostBeforeStart: boolean;
  lostAfterLive: boolean;
  completedPostLive: boolean;
  dropDate: string | null;
  dropReason: string | null;
  nomination: string | null;
  paymentTerm: string | null;
  resoldStatus: string | null;
  isResold: boolean;
  resoldFromContractId: string | null;
  annualUsageKwh: string | null;
  grossTcv: string | null;
  grossTcvXlsx: string | null;
  lostTcv: string | null;
  netTcv: string | null;
  netTcvXlsx: string | null;
  aqLoss: string | null;
  aqGain: string | null;
  netAq: string | null;
  aqCheck: string | null;
  lostPartial: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractListPage {
  items: ContractRow[];
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
    if (Number.isNaN(Date.parse(parsed.createdAt))) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

// SELECT all columns including the GENERATED ones so callers see Gross/Net TCV
// without an extra round-trip. Drizzle's default selection on `contracts`
// returns every column — listing them explicitly here pins the response shape.
const COLUMNS = {
  id: contracts.id,
  tenantId: contracts.tenantId,
  esiId: contracts.esiId,
  externalSaleId: contracts.externalSaleId,
  supplier: contracts.supplier,
  supplyType: contracts.supplyType,
  startDate: contracts.startDate,
  endDate: contracts.endDate,
  costPerKwh: contracts.costPerKwh,
  agentMils: contracts.agentMils,
  currency: contracts.currency,
  fxRate: contracts.fxRate,
  pipelineStatus: contracts.pipelineStatus,
  isLive: contracts.isLive,
  saleType: contracts.saleType,
  lostDate: contracts.lostDate,
  lostReason: contracts.lostReason,
  lostBeforeStart: contracts.lostBeforeStart,
  lostAfterLive: contracts.lostAfterLive,
  completedPostLive: contracts.completedPostLive,
  dropDate: contracts.dropDate,
  dropReason: contracts.dropReason,
  nomination: contracts.nomination,
  paymentTerm: contracts.paymentTerm,
  resoldStatus: contracts.resoldStatus,
  isResold: contracts.isResold,
  resoldFromContractId: contracts.resoldFromContractId,
  annualUsageKwh: contracts.annualUsageKwh,
  grossTcv: contracts.grossTcv,
  grossTcvXlsx: contracts.grossTcvXlsx,
  lostTcv: contracts.lostTcv,
  netTcv: contracts.netTcv,
  netTcvXlsx: contracts.netTcvXlsx,
  aqLoss: contracts.aqLoss,
  aqGain: contracts.aqGain,
  netAq: contracts.netAq,
  aqCheck: contracts.aqCheck,
  lostPartial: contracts.lostPartial,
  createdAt: contracts.createdAt,
  updatedAt: contracts.updatedAt,
} as const;

// Insert payload: every column callers may set. EXCLUDES `id`, `tenantId`
// (caller-arg), `createdAt`, `updatedAt`, AND the three GENERATED columns
// (`grossTcv`, `netTcv`, `netAq`) — those throw at the driver if written to.
export interface ContractInsert {
  esiId: string;
  externalSaleId?: string | null;
  supplier?: string | null;
  supplyType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  costPerKwh?: string | null;
  agentMils?: string | null;
  currency?: string;
  fxRate?: string;
  pipelineStatus?: string;
  isLive?: boolean;
  saleType?: string | null;
  lostDate?: string | null;
  lostReason?: string | null;
  lostBeforeStart?: boolean;
  lostAfterLive?: boolean;
  completedPostLive?: boolean;
  dropDate?: string | null;
  dropReason?: string | null;
  nomination?: string | null;
  paymentTerm?: string | null;
  resoldStatus?: string | null;
  isResold?: boolean;
  resoldFromContractId?: string | null;
  annualUsageKwh?: string | null;
  grossTcvXlsx?: string | null;
  lostTcv?: string | null;
  netTcvXlsx?: string | null;
  aqLoss?: string | null;
  aqGain?: string | null;
  aqCheck?: string | null;
  lostPartial?: boolean;
}

export type ContractUpdate = Partial<ContractInsert>;

export interface ContractFilters {
  esiId?: string;
  customerId?: string;
  pipelineStatus?: string;
  isLive?: boolean;
}

export async function listContracts(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null; filters?: ContractFilters },
): Promise<ContractListPage> {
  // Cursor pagination: (created_at desc, id desc). Composite tiebreak avoids
  // skipping rows that share a timestamp. Optional filters scope the listing
  // by ESI, owning customer (joined through esis → service_addresses), pipeline
  // status, or live state.
  //
  // Explicit `tenant_id` predicate is defense in depth (matches RLS) and gives
  // the planner a literal value for the composite index.
  return withTenantContext(db, tenantId, async (tx) => {
    const { esiId, customerId, pipelineStatus, isLive } = opts.filters ?? {};

    // `customerId` filter resolves to the set of ESI ids owned by service
    // addresses for that customer. Done as a subquery inside the main WHERE
    // so the outer query still hits `contracts_tenant_esi_idx`. RLS gates the
    // subquery just like the main query — cross-tenant customer ids return [].
    const customerEsiSubquery =
      customerId !== undefined
        ? tx
            .select({ id: esis.id })
            .from(esis)
            .innerJoin(serviceAddresses, eq(serviceAddresses.id, esis.serviceAddressId))
            .where(
              and(
                eq(esis.tenantId, tenantId),
                eq(serviceAddresses.tenantId, tenantId),
                eq(serviceAddresses.customerId, customerId),
              ),
            )
        : undefined;

    const cursorPredicate = opts.cursor
      ? or(
          lt(contracts.createdAt, new Date(opts.cursor.createdAt)),
          and(
            eq(contracts.createdAt, new Date(opts.cursor.createdAt)),
            lt(contracts.id, opts.cursor.id),
          ),
        )
      : undefined;
    const where = and(
      eq(contracts.tenantId, tenantId),
      esiId !== undefined ? eq(contracts.esiId, esiId) : undefined,
      customerEsiSubquery !== undefined ? inArray(contracts.esiId, customerEsiSubquery) : undefined,
      pipelineStatus !== undefined ? eq(contracts.pipelineStatus, pipelineStatus) : undefined,
      isLive !== undefined ? eq(contracts.isLive, isLive) : undefined,
      cursorPredicate,
    );

    const rows = await tx
      .select(COLUMNS)
      .from(contracts)
      .where(where)
      .orderBy(desc(contracts.createdAt), desc(contracts.id))
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

export async function getContractById(
  db: Db,
  tenantId: string,
  contractId: string,
): Promise<ContractRow | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(contracts)
      .where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function createContract(
  db: Db,
  tenantId: string,
  values: ContractInsert,
): Promise<ContractRow> {
  // Forces `tenantId` from the verified arg — caller can't smuggle a different
  // tenant in the body. RLS would reject a mismatch anyway but the explicit
  // assignment makes the boundary obvious.
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .insert(contracts)
      .values({ ...values, tenantId })
      .returning(COLUMNS);
    return rows[0]!;
  });
}

export async function updateContract(
  db: Db,
  tenantId: string,
  contractId: string,
  patch: ContractUpdate,
): Promise<ContractRow | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId)))
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteContract(
  db: Db,
  tenantId: string,
  contractId: string,
): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(contracts)
      .where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId)))
      .returning({ id: contracts.id });
    return rows.length > 0;
  });
}
