import type { JWTClaims } from "@supabase/server";
import type { Db } from "../db";

// Hono `Variables` filled in order: requestId → (jwtClaims/userId: jwtVerify)
// → (tenantId: tenantContext). `db` slot is lazy — only handlers that touch
// Postgres allocate the client via `getDb()`.
export interface ApiVars {
  requestId: string;
  jwtClaims: JWTClaims;
  tenantId: string;
  userId: string;
  db: Db;
}

export interface HonoEnv {
  Bindings: Env;
  Variables: ApiVars;
}
