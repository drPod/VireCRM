import { sql } from "drizzle-orm";
import type { Db } from "./index";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Runs `fn` inside a transaction with two pieces of context set so RLS
// policies actually engage on the Hyperdrive + postgres-js path:
//
//   1. `SET LOCAL ROLE authenticated` — Hyperdrive's connection string uses
//      Supabase's `postgres` role, which has `BYPASSRLS=true`. RLS policies
//      (scoped `TO authenticated`) never fire while connected as `postgres`.
//      Switching role per-transaction drops BYPASSRLS and matches the policy
//      role. `postgres` is granted membership in `authenticated`, so the
//      `SET ROLE` is permitted. `SET LOCAL` is transaction-scoped, so
//      Hyperdrive's transaction-mode pooler can safely return the connection
//      to the pool at COMMIT.
//
//   2. `set_config('request.jwt.claims', ...)` — `auth.jwt()` reads the bulk
//      JSON blob via `current_setting('request.jwt.claims', true)::jsonb`,
//      NOT the per-claim `request.jwt.claim.<name>` GUCs that PostgREST also
//      sets. Writing only the per-claim form leaves `auth.jwt()` NULL, so
//      policies of the form `auth.jwt() ->> 'tenant_id' = tenant_id` never
//      match. Bound parameter (no `sql.raw` interpolation).
//
// Defense-in-depth: query files should ALSO carry an explicit
// `eq(tenant_id, ?)` predicate. RLS is the security boundary; the literal
// predicate covers role/policy/migration regressions and lets the planner
// use composite indexes leading with `tenant_id` against a literal value.
export async function withTenantContext<T>(
  db: Db,
  tenantId: string,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(tenantId)) {
    throw new Error("withTenantContext: tenantId must be a valid UUID");
  }
  const claims = JSON.stringify({ tenant_id: tenantId });
  return db.transaction(async (tx) => {
    // Role first — claims-set as a non-superuser role would otherwise hit
    // permission errors on some Postgres configs. Role + GUC in one round-trip
    // via a multi-statement string would be ideal, but postgres-js + Drizzle's
    // `execute` issues each statement separately; two awaits is the cost.
    await tx.execute(sql`SET LOCAL ROLE authenticated`);
    await tx.execute(sql`SELECT set_config('request.jwt.claims', ${claims}, true)`);
    return fn(tx as unknown as Db);
  });
}
