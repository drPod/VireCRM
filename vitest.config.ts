import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { exportJWK, generateKeyPair } from "jose";

// Tests run inside a Miniflare-managed Worker isolate — same runtime as prod.
// `wrangler.configPath` makes the pool read `main`, compat flags, KV + Hyperdrive
// bindings, and the `vars` block straight from `wrangler.jsonc`. We only
// override what tests need beyond that.
//
// JWKS injection: generate an ES256 keypair at config-load time (Node side,
// before the Worker boots). Public set ships in as `SUPABASE_JWKS` so the
// Worker verifies locally-minted JWTs against the same key path used in prod.
// Private JWK ships in as `TEST_JWT_PRIVATE_JWK` so the in-Worker mint helper
// (tests/setup.ts) can sign without re-deriving.

// Wrangler's pool reads the Hyperdrive binding out of `wrangler.jsonc` and
// errors out if no local connection string is configured — even when no test
// touches the DB. Set the env var it looks up so config-load succeeds. Real
// runs override via `TEST_DB_URL`; default is unreachable so accidental DB
// access in a "no-DB" test fails loudly instead of hitting prod.
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??=
  process.env.TEST_DB_URL ??
  "postgres://placeholder:placeholder@127.0.0.1:1/placeholder";

const { publicKey, privateKey } = await generateKeyPair("ES256", {
  extractable: true,
});
const publicJwk = await exportJWK(publicKey);
const privateJwk = await exportJWK(privateKey);
publicJwk.kid = privateJwk.kid = "test-key-1";
publicJwk.alg = privateJwk.alg = "ES256";
publicJwk.use = "sig";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          SUPABASE_JWKS: JSON.stringify({ keys: [publicJwk] }),
          TEST_JWT_PRIVATE_JWK: JSON.stringify(privateJwk),
          TEST_KID: "test-key-1",
          HAS_TEST_DB: process.env.TEST_DB_URL ? "1" : "0",
        },
      },
    }),
  ],
});
