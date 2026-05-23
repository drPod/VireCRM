import type { MiddlewareHandler } from "hono";
import { verifyAuth } from "@supabase/server/core";
import { jsonError } from "../lib/errors";
import type { HonoEnv } from "../types";

interface JsonWebKeySet {
  keys: JsonWebKey[];
}

// Belt-and-braces guard: even though Supabase's JWKS only exposes asymmetric
// keys (so HS256 verification would already fail), we reject HS* up-front so
// a malformed JWKS or future lib regression can't open the symmetric path.
function isHsToken(token: string): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  try {
    const header = token.slice(0, dot);
    const b64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(header.length / 4) * 4, "=");
    const decoded = atob(b64);
    const parsed = JSON.parse(decoded) as { alg?: unknown };
    return typeof parsed.alg === "string" && parsed.alg.startsWith("HS");
  } catch {
    return false;
  }
}

function resolveJwks(env: Env): JsonWebKeySet | URL {
  // Tests inject an inline JWKS via `SUPABASE_JWKS` (JSON string) so the
  // worker can verify locally-minted JWTs without hitting Supabase. In prod
  // the worker fetches from the project's JWKS endpoint — `jose` handles the
  // edge cache + cooldown internally.
  const inline = (env as Env & { SUPABASE_JWKS?: string }).SUPABASE_JWKS;
  if (typeof inline === "string" && inline.length > 0) {
    return JSON.parse(inline) as JsonWebKeySet;
  }
  return new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
}

export const jwtVerify: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (authHeader) {
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    if (isHsToken(bearer)) return jsonError(c, 401, "INVALID_CREDENTIALS");
  }

  const { data: auth, error } = await verifyAuth(c.req.raw, {
    auth: "user",
    env: {
      url: c.env.SUPABASE_URL,
      publishableKeys: { default: c.env.SUPABASE_PUBLISHABLE_KEY },
      secretKeys: {},
      jwks: resolveJwks(c.env),
    },
  });

  if (error) {
    // 500-class auth errors (e.g. missing JWKS) bubble as INTERNAL — never
    // echo the lib's message to clients. 401s map cleanly to INVALID_CREDENTIALS.
    if (error.status >= 500) {
      console.error("[api] jwt-verify infra error", {
        requestId: c.get("requestId"),
        code: error.code,
        message: error.message,
      });
      return jsonError(c, 500, "INTERNAL");
    }
    return jsonError(c, 401, "INVALID_CREDENTIALS");
  }

  if (!auth.jwtClaims || !auth.userClaims) {
    return jsonError(c, 401, "INVALID_CREDENTIALS");
  }

  c.set("jwtClaims", auth.jwtClaims);
  c.set("userId", auth.userClaims.id);

  await next();
};
