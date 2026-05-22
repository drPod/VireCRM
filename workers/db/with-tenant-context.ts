import { sql } from "drizzle-orm";
import type { Db } from "./index";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Runs `fn` inside a transaction with `request.jwt.claim.tenant_id` set so
// Supabase's `auth.jwt()` returns the tenant claim. Required because the
// Hyperdrive + postgres-js path bypasses Supabase's PostgREST request-context
// injection, leaving `auth.jwt()` NULL and RLS policies denying every row.
export async function withTenantContext<T>(
  db: Db,
  tenantId: string,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(tenantId)) {
    throw new Error("withTenantContext: tenantId must be a valid UUID");
  }
  return db.transaction(async (tx) => {
    await tx.execute(
      sql.raw(`SET LOCAL request.jwt.claim.tenant_id = '${tenantId}'`),
    );
    return fn(tx as unknown as Db);
  });
}
