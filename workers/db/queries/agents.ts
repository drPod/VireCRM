import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../index";
import { agents } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { buildNextCursor, type Cursor, keysetWhere } from "./_pagination";

export interface AgentListItem {
  id: string;
  name: string;
  email: string | null;
  houseSplitPct: string | null;
  createdAt: Date;
}

export interface AgentListPage {
  items: AgentListItem[];
  nextCursor: string | null;
}

const COLUMNS = {
  id: agents.id,
  name: agents.name,
  email: agents.email,
  houseSplitPct: agents.houseSplitPct,
  createdAt: agents.createdAt,
} as const;

export async function listAgents(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null },
): Promise<AgentListPage> {
  // Explicit `tenant_id = ?` predicate is defense in depth against RLS gaps
  // (wrong role connecting via Hyperdrive, policy misconfig, future schema
  // change). It also lets the planner use the composite index
  // `agents_tenant_created_idx (tenant_id, created_at desc, id desc)` with a
  // literal rather than the `auth.jwt()->>tenant_id` function call from RLS.
  return withTenantContext(db, tenantId, async (tx) => {
    const tenantPredicate = eq(agents.tenantId, tenantId);
    const where = opts.cursor
      ? and(tenantPredicate, keysetWhere(COLUMNS, opts.cursor))
      : tenantPredicate;

    const rows = await tx
      .select(COLUMNS)
      .from(agents)
      .where(where)
      .orderBy(desc(agents.createdAt), desc(agents.id))
      .limit(opts.limit + 1);

    return buildNextCursor(rows, opts.limit);
  });
}

export async function getAgentById(
  db: Db,
  tenantId: string,
  agentId: string,
): Promise<AgentListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(agents)
      .where(and(eq(agents.tenantId, tenantId), eq(agents.id, agentId)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export interface CreateAgentInput {
  name: string;
  email?: string | null;
  houseSplitPct?: string | null;
}

export async function createAgent(
  db: Db,
  tenantId: string,
  input: CreateAgentInput,
): Promise<AgentListItem> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .insert(agents)
      .values({
        tenantId,
        name: input.name,
        email: input.email ?? null,
        houseSplitPct: input.houseSplitPct ?? null,
      })
      .returning(COLUMNS);
    const row = rows[0];
    if (!row) throw new Error("createAgent: insert returned no rows");
    return row;
  });
}

export interface UpdateAgentInput {
  name?: string;
  email?: string | null;
  houseSplitPct?: string | null;
}

export async function updateAgent(
  db: Db,
  tenantId: string,
  agentId: string,
  input: UpdateAgentInput,
): Promise<AgentListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    // Explicit null in `input` clears the column; omitted fields are skipped.
    const patch: Partial<typeof agents.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.email !== undefined) patch.email = input.email;
    if (input.houseSplitPct !== undefined) patch.houseSplitPct = input.houseSplitPct;

    const rows = await tx
      .update(agents)
      .set(patch)
      .where(and(eq(agents.tenantId, tenantId), eq(agents.id, agentId)))
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteAgent(db: Db, tenantId: string, agentId: string): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(agents)
      .where(and(eq(agents.tenantId, tenantId), eq(agents.id, agentId)))
      .returning({ id: agents.id });
    return rows.length > 0;
  });
}
