import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { agents } from "../schema";
import { withTenantContext } from "../with-tenant-context";

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
  // Composite tiebreak: (created_at desc, id desc). Without `id` in the cursor
  // simultaneous timestamps would skip rows or return duplicates across pages.
  //
  // Explicit `tenant_id = ?` predicate is defense in depth against RLS gaps
  // (wrong role connecting via Hyperdrive, policy misconfig, future schema
  // change).
  return withTenantContext(db, tenantId, async (tx) => {
    const tenantPredicate = eq(agents.tenantId, tenantId);
    const where = opts.cursor
      ? and(
          tenantPredicate,
          or(
            lt(agents.createdAt, new Date(opts.cursor.createdAt)),
            and(
              eq(agents.createdAt, new Date(opts.cursor.createdAt)),
              lt(agents.id, opts.cursor.id),
            ),
          ),
        )
      : tenantPredicate;

    const rows = await tx
      .select(COLUMNS)
      .from(agents)
      .where(where)
      .orderBy(desc(agents.createdAt), desc(agents.id))
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

export async function deleteAgent(
  db: Db,
  tenantId: string,
  agentId: string,
): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(agents)
      .where(and(eq(agents.tenantId, tenantId), eq(agents.id, agentId)))
      .returning({ id: agents.id });
    return rows.length > 0;
  });
}
