/**
 * Cloudflare Worker runtime type declarations — kept minimal on purpose.
 *
 * We deliberately do NOT pull in `@cloudflare/workers-types` because it
 * declares its own globals (Request, Response, Body, DOMException, etc.)
 * that conflict with the DOM lib this app needs for React. Instead we
 * declare just the types our worker entry + context module reference.
 *
 * Migration path when the first CF binding (KV, D1, R2, Durable Object,
 * Queue) lands: switch to Cloudflare's recommended `wrangler types` flow
 * with a split `tsconfig.worker.json` scoped to worker-only files, per
 * the vite-plugin tutorial
 * (https://developers.cloudflare.com/workers/vite-plugin/tutorial). Until
 * then, copy the relevant `interface` from
 * `@cloudflare/workers-types/index.d.ts` into this file rather than
 * adding the package to `tsconfig.json` `types` or loading it via
 * triple-slash — both would clobber DOM globals.
 *
 * Audit verdict (2026-05-18): shim is permanent until first binding;
 * zero CF native bindings in `wrangler.jsonc` today, tenant stack runs
 * over HTTP (Supabase / Resend / Anthropic / CF for SaaS REST). See
 * ISSUES.md `## Recent` + `docs/issues-archive/2026-05.md:148`.
 * Initial inventory: env-audit subagent run 2026-05-17, see
 * docs/superpowers/specs/2026-05-17-cloudflare-context-scaffold-design.md.
 */

declare global {
  /**
   * Shape of the `env` object passed to the worker's `fetch(request, env, ctx)`
   * handler. Mirrors `vars` from wrangler.jsonc + secrets set via
   * `wrangler secret put`. Keep in sync when adding new vars/secrets.
   */
  interface CloudflareEnv {
    // Wrangler vars block (public, non-secret)
    SUPABASE_URL: string;
    SUPABASE_PUBLISHABLE_KEY: string;

    // Required secrets
    SUPABASE_SERVICE_ROLE_KEY: string;
    ANTHROPIC_API_KEY: string;
    RESEND_API_KEY: string;
    CRON_SECRET: string;

    // Optional / feature-flagged secrets
    PLATFORM_APOLLO_API_KEY?: string;
    CONTACT_TEST_MODE?: string;
    CONTACT_TEST_INBOX?: string;
    PUBLISHED_URL?: string;
    SITE_URL?: string;

    // Cloudflare for SaaS custom-hostname provisioning. Both must be set
    // for `src/functions/custom-hostnames.functions.ts` to provision /
    // poll / teardown — missing either yields a 503 "CF for SaaS not
    // configured" response. See docs/custom-domains/cf-for-saas-setup.md.
    CLOUDFLARE_API_TOKEN?: string;
    CLOUDFLARE_ZONE_ID?: string;

    // Future bindings land here as: MY_KV: KVNamespace; DB: D1Database; etc.
  }

  /**
   * Minimal shape of the per-request CF Workers ExecutionContext. The full
   * type is much larger; we only consume `waitUntil` here.
   * Reference: https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/
   */
  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException?(): void;
  }

  /**
   * Minimal stand-in for `IncomingRequestCfProperties` (CF-added request
   * metadata: country, colo, asn, etc.). We don't consume any property
   * directly; consumers that want a specific field can cast as needed.
   */
  type IncomingRequestCfProperties = Record<string, unknown>;
}

export {};
