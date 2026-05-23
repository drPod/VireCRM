import { eq } from "drizzle-orm";
import type { Db } from "../index";
import { tenants } from "../schema";

export interface TenantRow {
  id: string;
  name: string;
  subdomain: string;
}

// Subdomain → tenant lookup. Runs outside `withTenantContext` on purpose:
// `tenants` has no RLS policy, so this is the one query allowed to read across
// tenants — it's how we resolve the tenant in the first place.
export async function loadTenantBySubdomain(
  db: Db,
  subdomain: string,
): Promise<TenantRow | null> {
  const rows = await db
    .select({ id: tenants.id, name: tenants.name, subdomain: tenants.subdomain })
    .from(tenants)
    .where(eq(tenants.subdomain, subdomain))
    .limit(1);
  return rows[0] ?? null;
}
