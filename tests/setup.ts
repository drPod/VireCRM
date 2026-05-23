import { importJWK, SignJWT, type CryptoKey } from "jose";
import { env } from "cloudflare:test";

// In-worker test helpers. The keypair was generated once in vitest.config.ts
// (Node side); we import the private JWK on first use to mint tokens. The
// Worker itself sees only `SUPABASE_JWKS` (the public set) and uses it for
// verification — production-identical code path.

declare global {
  namespace Cloudflare {
    interface Env {
      SUPABASE_JWKS: string;
      TEST_JWT_PRIVATE_JWK: string;
      TEST_KID: string;
      HAS_TEST_DB: "0" | "1";
    }
  }
}

let cachedKey: Promise<CryptoKey> | null = null;
function getPrivateKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    const jwk = JSON.parse(env.TEST_JWT_PRIVATE_JWK) as JsonWebKey;
    cachedKey = importJWK(jwk, "ES256") as Promise<CryptoKey>;
  }
  return cachedKey;
}

export interface MintJwtOptions {
  sub?: string;
  tenantId?: string | null; // null = omit `app_metadata.tenant_id` entirely
  role?: string; // top-level role claim
  appMetadataRole?: string;
  email?: string;
  expiresInSeconds?: number; // negative = expired
  audience?: string;
  issuer?: string;
  omitAppMetadata?: boolean;
}

export async function mintJwt(opts: MintJwtOptions = {}): Promise<string> {
  const key = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const expSec = opts.expiresInSeconds ?? 3600;

  const payload: Record<string, unknown> = {
    sub: opts.sub ?? "00000000-0000-4000-8000-000000000001",
    role: opts.role ?? "authenticated",
    email: opts.email ?? "test@example.com",
    iat: now,
    exp: now + expSec,
  };

  if (!opts.omitAppMetadata) {
    const appMeta: Record<string, unknown> = {};
    if (opts.tenantId !== null) {
      appMeta.tenant_id =
        opts.tenantId ?? "00000000-0000-4000-8000-000000000001";
    }
    if (opts.appMetadataRole) appMeta.role = opts.appMetadataRole;
    payload.app_metadata = appMeta;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: env.TEST_KID })
    .setIssuer(opts.issuer ?? env.SUPABASE_URL)
    .setAudience(opts.audience ?? "authenticated")
    .sign(key);
}

// Symmetric token used only to assert the Worker rejects HS-family algs.
export async function mintHs256Jwt(): Promise<string> {
  const secret = new TextEncoder().encode("test-shared-secret-do-not-trust");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: "00000000-0000-4000-8000-000000000001",
    role: "authenticated",
    iat: now,
    exp: now + 3600,
    app_metadata: { tenant_id: "00000000-0000-4000-8000-000000000001" },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(secret);
}

export const HOST_TENANT_A = "greenenergiai.virecrm.com";
export const HOST_TENANT_B = "testbravo.virecrm.com";
export const HOST_CUSTOMERS = "customers.virecrm.com";
export const HOST_APEX = "virecrm.com";

export const hasTestDb = env.HAS_TEST_DB === "1";

// Lazily resolves seeded tenant IDs from the live DB. Called by DB-touching
// tests; caches per-isolate.
let cachedTenantIds: Promise<{ a: string; b: string }> | null = null;
export function getSeededTenantIds(): Promise<{ a: string; b: string }> {
  if (!cachedTenantIds) {
    cachedTenantIds = (async () => {
      const { makeDb } = await import("../workers/db");
      const { tenants } = await import("../workers/db/schema");
      const { sql } = await import("drizzle-orm");
      const db = makeDb(env);
      // Ensure both test tenants exist (seed migration covers greenenergiai;
      // testbravo is test-only and added idempotently here).
      await db.execute(sql`
        INSERT INTO tenants (name, subdomain)
        VALUES ('testbravo', 'testbravo')
        ON CONFLICT (subdomain) DO NOTHING
      `);
      const rows = await db
        .select({ id: tenants.id, subdomain: tenants.subdomain })
        .from(tenants)
        .where(sql`${tenants.subdomain} IN ('greenenergiai', 'testbravo')`);
      const a = rows.find((r) => r.subdomain === "greenenergiai")?.id;
      const b = rows.find((r) => r.subdomain === "testbravo")?.id;
      if (!a || !b) throw new Error("test seed: expected tenants missing");
      return { a, b };
    })();
  }
  return cachedTenantIds;
}
