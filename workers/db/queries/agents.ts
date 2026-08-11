import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { agents } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { type Cursor, decodeCursor, encodeCursor } from "./_cursor";

// Re-exported so the route layer (`workers/api/routes/agents.ts`) keeps
// its single import surface for the query module.
export { decodeCursor };

// Read-only projection. Agents are created out-of-band (xlsx migration);
// this endpoint exists so the frontend can resolve `primaryAgentId` /
// `secondaryAgentId` on deals to names and populate agent pickers.
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
  // Composite tiebreak: (created_at desc, id desc) — same keyset scheme as
  // every other list query. Explicit `tenant_id` predicate is defense in
  // depth against RLS gaps and gives the planner a literal for the index.
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
