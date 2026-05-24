import { sql } from "drizzle-orm";
import type { Db } from "./index";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Runs `fn` inside a transaction with the JWT-claims GUC populated so
// Supabase's `auth.jwt()` returns the tenant claim. Required because the
// Hyperdrive + postgres-js path bypasses Supabase's PostgREST request-context
// injection, leaving `auth.jwt()` NULL and RLS policies denying every row.
//
// `auth.jwt()` reads `current_setting('request.jwt.claims', true)::jsonb` —
// the bulk JSON blob — NOT the per-claim `request.jwt.claim.<name>` GUCs that
// PostgREST also sets. Writing only the per-claim form leaves `auth.jwt()`
// NULL, so policies of the form `auth.jwt() ->> 'tenant_id' = tenant_id` never
// match. Use `set_config()` with a bound parameter (no `sql.raw` interpolation)
// to populate the bulk blob.
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
    await tx.execute(sql`SELECT set_config('request.jwt.claims', ${claims}, true)`);
    return fn(tx as unknown as Db);
  });
}
