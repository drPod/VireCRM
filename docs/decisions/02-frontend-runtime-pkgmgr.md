# 02 — Frontend + Runtime + Package Manager

> **⚠ Agent-authored.** Drafted by AI agents from research + conversation context. Expect AI-pattern reasoning, **and expect baked-in assumptions** — agents make assumptions constantly (about scale, intent, prior art, constraints) and confidence does not equal correctness. Do not blindly follow this doc; verify load-bearing claims, assumptions included, before relying on them.

**Status:** vetted 2026-05-22
**Scope:** the three coupled choices the prior agent locked into `README.md`, `CLAUDE.md`, `AGENTS.md`: frontend framework, runtime/deploy target, package manager.

---

## 1. Verdict

| Sub-choice | Verdict | One-liner |
|---|---|---|
| Frontend = TanStack Start | **change → React Router v7 (framework mode)** | TanStack Start still 1.0-RC with active breaking changes + an open production-build regression on Workers; React Router v7 is the framework Cloudflare's own GA announcement endorses as "first" on the Vite plugin and is Shopify-backed and battle-tested. |
| Runtime = Cloudflare Workers | **keep** | Right call. Routes already configured for `virecrm.com` + `*.virecrm.com/*` (`wrangler.jsonc:25-36`); Workers is the cheapest, lowest-ops home for a Worker-as-Airtable-proxy + SSR React shell; static assets free; multi-tenant by Host header is idiomatic. |
| Package manager = Bun | **tweak** | Bun is fine to use locally, but the "Bun only / foreign lockfiles git-ignored" rule is over-prescriptive: Cloudflare's own build image pre-installs Bun 1.2.15 alongside npm/yarn/pnpm with no preference. Demoting the rule from "invariant" to "preference" removes a tripwire without losing anything. |

**Bottom line:** keep Workers, keep Bun-as-default, **swap TanStack Start for React Router v7**.

The prior justification for TanStack Start in `README.md:103` — *"Inherited from the prior Lovable scaffold and kept"* — is invalid (repo nuked in commit `719a7fd`). It must be replaced with real reasoning regardless of which framework wins.

---

## 2. Decision being vetted

Verbatim from the agent files:

- `README.md:103` — *"**Frontend:** TanStack Start (React + Vite + file-based routing + SSR). Inherited from the prior Lovable scaffold and kept."*
- `README.md:108` — *"**Deploy:** Cloudflare Workers via Wrangler. Routes in `wrangler.jsonc` cover `virecrm.com` (canonical) and `majix.ai/*` (308 → virecrm). Wildcard `*.virecrm.com/*` carries the tenant subdomains."*
- `README.md:109` — *"**Package manager:** Bun only. Foreign lockfiles git-ignored."*
- `CLAUDE.md:18` — *"**TanStack Start SPA.** React + Vite + file-based routing + SSR. Inherited from prior Lovable scaffold, kept."*
- `CLAUDE.md:30-32` — *"**Bun only.** ... **TanStack Start kept.** Don't propose Next.js / Remix / plain Vite swap without strong reason. **CF Workers deploy.**"*
- `AGENTS.md:41-43` — *"**Bun only.** Foreign lockfiles git-ignored. **TanStack Start kept** (existing scaffold). **CF Workers deploy.** No long-running Node procs."*
- `wrangler.jsonc:4-6` — `main: "./src/server.ts"`, `compatibility_date: "2026-05-17"`, `compatibility_flags: ["nodejs_compat"]`.

The "inherited from Lovable" provenance is wrong: `719a7fd chore: nuke everything for rebuild` deleted the prior scaffold. Anything left has to stand on a fresh-pick argument.

---

## 3. Evidence

### 3.1 TanStack Start maturity (the load-bearing weakness)

- **Still RC, not stable.** TanStack Start hit v1.0 Release Candidate (RC) and is "feature-complete and API-stable, approaching 1.0," but stable 1.0 has not shipped as of May 2026. The tracking discussion shows breaking changes still landing in RC: `validator → inputValidator` rename, server-entry signature changes, unified route tree restructuring. ([TanStack v1 RC announcement](https://tanstack.com/blog/announcing-tanstack-start-v1), [Start BETA tracking discussion #2863](https://github.com/TanStack/router/discussions/2863))
- **Recent Vinxi → Vite migration was a breaking-change event.** v1.121.0 removed `ssr.tsx`/`client.tsx`, moved config from `app.config.ts` to `vite.config.ts`, changed default base dir from `app` to `src`, switched from `createAPIFileRoute()` to `createServerFileRoute()`, and renamed `@tanstack/start` → `@tanstack/react-start`. Migration was non-trivial. ([LogRocket: Migrating Tanstack Start from Vinxi to Vite](https://blog.logrocket.com/migrating-tanstack-start-vinxi-vite/))
- **Open production-breaking bug on this exact stack.** `[Bug] TanStack Start 1.142.x breaks production builds with Cloudflare Workers and middleware using platform-specific imports` (router #6185), plus `Can't find module "cloudflare:workers" when using RC with the Cloudflare Vite Plugin` (#5208) and `Streaming server functions return empty response body with @cloudflare/vite-plugin` (#6045). Production-builds-breaking on the chosen runtime, fresh issues. ([router#6185](https://github.com/TanStack/router/issues/6185), [router#5208](https://github.com/TanStack/router/issues/5208), [router#6045](https://github.com/TanStack/router/issues/6045))
- **Cloudflare's GA endorsement post conspicuously omits TanStack Start.** "Your frontend, backend, and database — now in one Cloudflare Worker" lists React Router v7, Astro, Hono, Vue, Nuxt, Svelte as GA on the Vite plugin; TanStack Start is mentioned in the framework-guides docs but not in the GA "we recommend these" post. React Router v7 is called out as "the first full-stack framework to provide full support for the Cloudflare Vite plugin." ([Cloudflare full-stack on Workers](https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/), [Cloudflare Vite plugin GA changelog](https://developers.cloudflare.com/changelog/post/2025-04-08-vite-plugin/))

### 3.2 TanStack Start has real merits — not nothing

- **Deploy works.** `wrangler deploy` auto-detects, `@tanstack/react-start v1.138.0+` required for static prerender, `nodejs_compat` needed, assets served from `.output/public`. ([CF docs: TanStack Start](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/))
- **End-to-end type safety on routes.** Type-safe file-based routing, deep TanStack Query integration, build-time route validation. Real advantage over Remix/RR. ([TanStack v1 RC announcement](https://tanstack.com/blog/announcing-tanstack-start-v1))
- **Smaller client JS than Next.js.** Reported ~30–35% smaller. ([Software Thug: TanStack Start on CF Workers](https://www.softwarethug.com/posts/tanstack-start-cloudflare-workers-full-stack/))

### 3.3 React Router v7 framework mode (the recommended swap)

- **Remix merged into React Router v7.** "Framework mode" of v7 is the direct successor to Remix v2 — loaders, actions, nested routing, server rendering, file-based routing. Shopify-backed, 3+ years production track record (Hydrogen storefronts). ([React Router v7 announcement](https://remix.run/blog/react-router-v7), [Lucky Media Remix review 2026](https://www.luckymedia.dev/insights/remix))
- **First-class Cloudflare support.** `npm create cloudflare@latest -- my-app --framework=react-router` scaffolds it. Cloudflare Vite plugin v1.0 GA supports SSR, file-based routing, bindings access. Auto-detects with Wrangler. ([CF docs: React Router](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/))
- **Single tradeoff vs TanStack Start:** RR v7 requires `nodejs_compat` and SSR mode (SPA mode + prerendering not supported through the Vite plugin). For this app — auth-gated CRM dashboard — SSR is fine and not a real downside.

### 3.4 Cloudflare Workers (keep)

- **Bundle size: 10 MB compressed (paid) / 3 MB (free) / 64 MB uncompressed.** Plenty for an SSR React shell + Airtable client + Supabase client. ([CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/))
- **Static asset serving is free** (only Worker code execution billed). Perfect for the SPA shell. ([Cloudflare full-stack on Workers](https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/))
- **Routes already wired:** `wrangler.jsonc:25-36` covers `virecrm.com/*` + wildcard `*.virecrm.com/*` for tenants, plus `majix.ai` legacy redirects. Reusable as-is.
- **Multi-tenant by Host header is idiomatic on Workers.** Workers-for-SaaS / Custom Hostnames pattern is well-trodden. ([Docat: Multi-Tenant SaaS on Cloudflare Workers 2026](https://medium.com/@docat0209/how-to-build-a-multi-tenant-saas-on-cloudflare-workers-for-0-month-2026-8a0539c92a26))

### 3.5 `nodejs_compat` flag (keep, document why)

- **Required by every framework option here.** OpenNext-Next.js, React Router v7, TanStack Start, Astro all require `nodejs_compat`. ([CF Next.js docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/))
- **No performance penalty per Cloudflare.** "We recommend starting with the `nodejs_compat` flag, which will enable everything. ... There is no performance penalty to having the additional features enabled." Native runtime implementations in TypeScript/C++, not polyfill injection. 11 core modules native: `crypto`, `fs` (virtual), `http`/`https`, `net`/`tls`, `process`, `timers`, `zlib`, etc. ([CF: A year of improving Node.js compatibility](https://blog.cloudflare.com/nodejs-workers-2025/))
- **Already set** in `wrangler.jsonc:6` with `compatibility_date: "2026-05-17"`.

### 3.6 Bun (tweak — soften from "only" to "preferred")

- **Bun 1.2.15 is pre-installed in the Cloudflare Workers build image** alongside npm 10.9.2, yarn 4.9.1, pnpm 10.11.1. ([CF: Workers Build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/))
- **`bun.lock` (text format) is detected** by CF Pages/Workers builds, but there are reports of detection issues with the legacy `bun.lockb` binary lockfile, and a documented gotcha: builds fail with `"lockfile had changes, but lockfile is frozen"` unless `bun install` is explicitly run before `wrangler deploy` in the CI build command. Fixable, not blocking, but worth knowing. ([Bun.lock CF gist](https://gist.github.com/danawoodman/d55995dec9e43433c6d426ea86c41513), [CF Community: bun.lock not detected](https://community.cloudflare.com/t/bun-not-detected-as-tool-when-using-new-bun-lock-instead-of-bun-lockb/779835))
- **Why "tweak" not "keep":** the `package-lock.json` git-ignore line is a footgun. Some `bunx create-*` scaffolds and many published templates still ship `package-lock.json`; git-ignoring it silently swallows the scaffold's intent. Better policy: commit `bun.lock`, *.lockb*-style binary blocked, and only warn (not silently strip) if a foreign lockfile appears.

### 3.7 Worker bundle budget for this stack

Rough estimate for the chosen stack (RR v7 + Supabase auth client + Airtable REST client + Stripe + MS Graph token refresh):
- React + RR v7 SSR runtime: ~150 KB compressed
- `@supabase/supabase-js` v2: ~30 KB compressed
- Airtable REST (custom, no SDK): ~5 KB
- Stripe (REST, server-side): ~10 KB
- App code + types: budget 200 KB

Comfortably under the 3 MB free-tier compressed cap, never mind the 10 MB paid cap. No need to chunk-split for size — split only if cold-start CPU budget (1 s top-level execution) is hit, which it won't be at this size. ([CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/))

---

## 4. Alternatives considered

### Next.js 15 App Router (via OpenNext Cloudflare adapter)

- **When right:** ecosystem dominance, hireability, Vercel's most-funded ecosystem, biggest plugin/template library.
- **Why not here:** OpenNext Cloudflare adapter is at 1.0-beta, edge runtime not supported, Windows not fully supported. Heavier than RR v7 (the ~30–35% larger client-JS report cuts both ways). For a small-team CRM, the App Router learning tax (RSC, Server Actions, intercepting routes) is not paid back. ([OpenNext Cloudflare docs](https://opennext.js.org/cloudflare), [CF Next.js docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/))

### Remix v2 (pre-merger)

- **When right:** if you're already on a Remix v2 codebase.
- **Why not here:** superseded by React Router v7 framework mode in May 2024. New projects should start on RR v7. ([React Router v7 announcement](https://remix.run/blog/react-router-v7))

### Astro 5 SSR (via `@astrojs/cloudflare`)

- **When right:** content-heavy / marketing site with islands of interactivity. SEO-critical.
- **Why not here:** this is an auth-gated CRM dashboard. JS is always available, every page is dynamic, no SEO need. Astro's "ship less JS" advantage doesn't apply — we need a full SPA-style React app behind the login. ([CF Astro docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/))

### Plain Vite SPA + Hono Worker (no React-side framework)

- **When right:** truly simple dashboards where you'd otherwise fight a framework. Smallest possible footprint. Full control.
- **Why not here:** ~50 auth-gated routes (per memory bank) means file-based routing carries real weight. Building it on top of bare `react-router-dom` re-implements what RR v7 framework mode gives free (loaders, actions, SSR, type-safe routes). And you'd still need an SSR strategy for first paint or accept a blank-flash + late-redirect on every auth gate. ([Hono CF docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/))
- **Honorable mention:** Hono is a great pairing *inside* a Worker that's also serving an SSR framework — it can handle the `/api/*` REST routes the SPA hits. Worth using internally inside `src/server.ts` even with RR v7.

### Plain Vite SPA + REST-only Worker (SPA-only, no SSR)

- **When right:** dashboards where first-paint isn't a UX bar and you want simplest mental model.
- **Why not here:** loses streaming, loaders, route-level data prefetching, server-side auth gating at the route boundary. Adds spinner-flash on every navigation. For a CRM where the CEO's first impression matters, SSR pays for itself.

### TanStack Start (the incumbent)

- **When right:** when end-to-end type safety on routes + deep TanStack Query integration are deal-makers and the team can absorb RC churn.
- **Why not here:** see §3.1. The single benefit over RR v7 (route type safety) doesn't outweigh shipping on a framework with open production-build-breaking bugs on the chosen runtime. Recheck after stable 1.0.

---

## 5. Proposed agent-file edits

Caveman for `CLAUDE.md` / `AGENTS.md` / `TASKS.md` / `HANDOFF.md`. Full prose for `README.md`.

### `README.md:101-110` — replace the entire Stack section

Replace:

```
## Stack

- **Frontend:** TanStack Start (React + Vite + file-based routing + SSR). Inherited from the prior Lovable scaffold and kept.
- **Backend:** Airtable (workspace `wspBUTSYGFioquhDD`). One base per tenant. Schema mutations via API. Single service PAT held by the Worker — customers never get an Airtable seat.
- **API layer:** Cloudflare Worker (`src/server.ts`). Handles auth, per-tenant routing by Host header, RLS, caching, batching against Airtable's 5 req/sec limit, Outlook OAuth.
- **Auth (for our app users):** Supabase Auth (`coynbufhejaeuifpvmvw.supabase.co`). Customer Postgres is *not* the data store right now — it just holds users + sessions until we migrate the domain data off Airtable.
- **Payments:** Stripe (account `51TYVK6`, currently test-mode key `pk_test_REPLACE_ME` — needs replacing from dashboard).
- **Deploy:** Cloudflare Workers via Wrangler. Routes in `wrangler.jsonc` cover `virecrm.com` (canonical) and `majix.ai/*` (308 → virecrm). Wildcard `*.virecrm.com/*` carries the tenant subdomains.
- **Package manager:** Bun only. Foreign lockfiles git-ignored.
```

With:

```
## Stack

- **Frontend:** React Router v7 in framework mode (formerly Remix). React + Vite + file-based routing + SSR + loaders/actions. Picked over TanStack Start because RR v7 is Shopify-backed, production-battle-tested, and is the framework Cloudflare's own GA post calls out as "first full-stack framework with full Cloudflare Vite plugin support." TanStack Start was the prior scaffold's pick but the repo was wiped before any of that survived; from a clean slate, RR v7 + the GA Cloudflare Vite plugin is the safer bet until TanStack Start ships stable 1.0 and the open production-build regressions on Workers (e.g. router #6185) close out. Internal `/api/*` routes inside the Worker may use Hono if hand-rolled handlers get unwieldy.
- **Backend:** Airtable (workspace `wspBUTSYGFioquhDD`). One base per tenant. Schema mutations via API. Single service PAT held by the Worker — customers never get an Airtable seat.
- **API layer:** Cloudflare Worker (`src/server.ts`). Handles auth, per-tenant routing by Host header, RLS, caching, batching against Airtable's 5 req/sec limit, Outlook OAuth.
- **Auth (for our app users):** Supabase Auth (`coynbufhejaeuifpvmvw.supabase.co`). Customer Postgres is *not* the data store right now — it just holds users + sessions until we migrate the domain data off Airtable.
- **Payments:** Stripe (account `51TYVK6`, currently test-mode key `pk_test_REPLACE_ME` — needs replacing from dashboard).
- **Deploy:** Cloudflare Workers via Wrangler with the official `@cloudflare/vite-plugin` (v1.0 GA). Routes in `wrangler.jsonc` cover `virecrm.com` (canonical) and `majix.ai/*` (308 → virecrm). Wildcard `*.virecrm.com/*` carries tenant subdomains. `compatibility_flags: ["nodejs_compat"]` enabled — required by the framework and zero runtime cost per Cloudflare.
- **Package manager:** Bun preferred (`bun.lock` text format committed). npm/pnpm tolerated in a pinch; CI uses `bun install` then `wrangler deploy`. Foreign lockfiles are not auto-stripped — if one appears, decide explicitly.
```

Also update the architecture diagram at `README.md:87-93` to reflect the framework swap:

```
greenenergiai.virecrm.com (React Router v7 + Vite SSR on Workers)
  ↓
Cloudflare Worker (auth, RLS, caching, Outlook OAuth, batching)
  ↓
Airtable API (one base per customer, single service PAT)
```

Also update `README.md:88` (one-line diagram in the same block) accordingly.

### `CLAUDE.md:10-20` — replace the Architecture block

Replace:

```
## Architecture (do not relitigate without cause)

```
SPA (TanStack Start) → CF Worker → Airtable API
```

- **Airtable = data backend.** One base per tenant. Workspace `wspBUTSYGFioquhDD`. Single service PAT held by Worker. Customers never touch airtable.com.
- **Worker = only Airtable client.** Frontend talks to Worker, never to Airtable directly. Worker handles auth, tenant routing by Host header, RLS, caching (5 req/sec ceiling), batching (10 records/req), Outlook OAuth.
- **TanStack Start SPA.** React + Vite + file-based routing + SSR. Inherited from prior Lovable scaffold, kept.
- **Supabase Auth only.** No domain data in Postgres yet. Just users + sessions. Domain data = Airtable until migration.
- **Migration plan.** Airtable → Postgres at customer 10-20 or first scaling pain. Worker abstracts Airtable so migration = swap one module.
```

With:

```
## Architecture (do not relitigate without cause)

```
React Router v7 (SSR, Vite) → CF Worker → Airtable API
```

- **Airtable = data backend.** One base per tenant. Workspace `wspBUTSYGFioquhDD`. Single service PAT held by Worker. Customers never touch airtable.com.
- **Worker = only Airtable client.** Frontend talks to Worker, never Airtable direct. Worker handles auth, tenant routing by Host header, RLS, caching (5 req/sec ceiling), batching (10 records/req), Outlook OAuth.
- **React Router v7 framework mode.** React + Vite + file routes + SSR + loaders/actions. Picked over TanStack Start: RR v7 GA on CF Vite plugin, Shopify-backed, prod battle-tested. TanStack Start still 1.0-RC + open prod-build bug on Workers (router #6185). Reconsider at TanStack Start stable.
- **Supabase Auth only.** No domain data in Postgres yet. Just users + sessions. Domain data = Airtable until migration.
- **Migration plan.** Airtable → Postgres at customer 10-20 or first scaling pain. Worker abstracts Airtable, migration = swap one module.
```

### `CLAUDE.md:28-33` — replace Stack invariants

Replace:

```
## Stack invariants

- **Bun only.** `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` git-ignored. Never recreate.
- **TanStack Start kept.** Don't propose Next.js / Remix / plain Vite swap without strong reason.
- **CF Workers deploy.** Anything that needs long-running Node process is wrong tool here.
- **No Atomic CRM.** Decided against. Don't reopen.
```

With:

```
## Stack invariants

- **Bun preferred** (`bun.lock` committed). npm/pnpm tolerated. Don't silently strip foreign lockfiles — flag + decide.
- **React Router v7 (framework mode) on `@cloudflare/vite-plugin`.** Don't propose Next.js / Astro / TanStack Start swap without strong reason (re-evaluate TanStack Start at its stable 1.0).
- **CF Workers deploy.** No long-running Node procs. `nodejs_compat` on, zero runtime cost.
- **No Atomic CRM.** Decided against. Don't reopen.
```

### `AGENTS.md:18` — fix architecture one-liner

Replace:

```
`SPA (TanStack Start) → CF Worker → Airtable API`. Worker = only Airtable client. Supabase Auth for users. Migrate to Postgres at scale.
```

With:

```
`React Router v7 (SSR, Vite) → CF Worker → Airtable API`. Worker = only Airtable client. Supabase Auth for users. Migrate to Postgres at scale.
```

### `AGENTS.md:34-46` — refresh tool routing + invariants

Replace:

```
- Library docs (TanStack, Wrangler, Supabase, Stripe, MS Graph) → `context7` MCP.
```
With:
```
- Library docs (React Router, Vite, Wrangler, Supabase, Stripe, MS Graph, Hono) → `context7` MCP.
```

Replace `AGENTS.md:39-46` Stack invariants block:

```
## Stack invariants

- **Bun only.** Foreign lockfiles git-ignored.
- **TanStack Start kept** (existing scaffold).
- **CF Workers deploy.** No long-running Node procs.
- **Airtable backend** (do not migrate to Postgres without explicit decision).
- **No generic OSS CRM fork.** Atomic / Twenty / NextCRM all evaluated, all rejected.
```

With:

```
## Stack invariants

- **Bun preferred** (commit `bun.lock` text format). npm/pnpm tolerated.
- **React Router v7** framework mode on `@cloudflare/vite-plugin` (v1.0 GA). Re-eval TanStack Start at stable 1.0.
- **CF Workers deploy.** `nodejs_compat` on. No long-running Node procs.
- **Airtable backend** (do not migrate to Postgres without explicit decision).
- **No generic OSS CRM fork.** Atomic / Twenty / NextCRM all evaluated, all rejected.
```

### `TASKS.md:14` — fix Phase 0 architecture line

Replace:

```
- [x] **Architecture decided.** Airtable backend + Cloudflare Worker + TanStack Start SPA. See README "Architecture." Atomic CRM, Twenty, NextCRM all rejected.
```

With:

```
- [x] **Architecture decided.** Airtable backend + Cloudflare Worker + React Router v7 (Vite SSR). See README "Architecture." Atomic CRM, Twenty, NextCRM all rejected. TanStack Start considered + rejected (RC + open prod-build bug on Workers — `docs/decisions/02-frontend-runtime-pkgmgr.md`).
```

### `TASKS.md:18` — fix bootstrap step

Replace:

```
- [ ] **TanStack Start bootstrap.** Existing repo nuked. Rescaffold TanStack Start app, wire to Worker as backend, point Worker at Airtable. Bun-only.
```

With:

```
- [ ] **RR v7 bootstrap.** `bun create cloudflare@latest -- . --framework=react-router`. Wire to Worker (`src/server.ts`) as backend, point Worker at Airtable. Commit `bun.lock`.
```

### `HANDOFF.md:23` — fix decision-locked line

Replace:

```
6. **Frontend:** TanStack Start kept (was nuked but stack choice survives).
```

With:

```
6. **Frontend:** React Router v7 (framework mode) on `@cloudflare/vite-plugin`. Prior agent picked TanStack Start citing "inherited from Lovable" — repo was nuked, that justification dead. Re-vetted in `docs/decisions/02-frontend-runtime-pkgmgr.md`; RR v7 wins until TanStack Start ships stable 1.0.
```

### `HANDOFF.md:49` — fix scaffold command

Replace:

```
3. **Bootstrap TanStack Start app.** `bunx create-tsrouter-app@latest .` or whatever the current TanStack Start scaffold command is — verify via context7 first.
```

With:

```
3. **Bootstrap RR v7 app.** `bun create cloudflare@latest -- . --framework=react-router` (auto-scaffolds with `@cloudflare/vite-plugin`, SSR, file routes). Verify current syntax via context7 + CF docs before running.
```

---

## 6. Open questions for user

1. **Type-safety appetite.** TanStack Start's main edge is build-time route type safety. RR v7 has it too via the `+types` files but the DX is reportedly a step behind. If the user values that specific DX heavily enough to absorb RC churn, they can override this verdict.
2. **Hono inside the Worker for `/api/*`?** RR v7 owns the SSR + loaders/actions surface, but the Worker also needs REST handlers for webhooks (Stripe, Airtable, MS Graph). Suggest layering Hono inside `src/server.ts` for those — confirm.
3. **Lockfile policy — strict-only-bun, or pragmatic?** This vet softens to "preferred." If the user actively wants to enforce no-other-managers (e.g. for team consistency), keep the git-ignore but add an explicit `engines` block in `package.json` + a CI check that fails on `package-lock.json` instead of silently dropping it.
4. **Wrangler `routes` vs Workers for SaaS / Custom Hostnames.** The current wildcard `*.virecrm.com/*` covers all tenants under one Worker zone — fine for early days. At scale (10+ tenants, custom-domain customers like `crm.acme.com`), Cloudflare for SaaS / Custom Hostnames is the right path. Out of scope for this vet but flag for the runtime owner.

---

## Sources

- [TanStack Start v1 RC announcement](https://tanstack.com/blog/announcing-tanstack-start-v1)
- [TanStack Start BETA Tracking — discussion #2863](https://github.com/TanStack/router/discussions/2863)
- [LogRocket — Migrating TanStack Start from Vinxi to Vite](https://blog.logrocket.com/migrating-tanstack-start-vinxi-vite/)
- [TanStack router #6185 — 1.142.x breaks production builds with CF Workers + middleware](https://github.com/TanStack/router/issues/6185)
- [TanStack router #5208 — `cloudflare:workers` module not found with CF Vite plugin](https://github.com/TanStack/router/issues/5208)
- [TanStack router #6045 — streaming server functions return empty body with `@cloudflare/vite-plugin`](https://github.com/TanStack/router/issues/6045)
- [Cloudflare — TanStack Start framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Cloudflare — React Router framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- [Cloudflare — full-stack development on Workers (GA frameworks announcement)](https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/)
- [Cloudflare — Vite plugin GA changelog (2025-04-08)](https://developers.cloudflare.com/changelog/post/2025-04-08-vite-plugin/)
- [Cloudflare — a year of improving Node.js compatibility (Sep 2025)](https://blog.cloudflare.com/nodejs-workers-2025/)
- [Cloudflare — Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare — Workers Build image (Bun 1.2.15, npm 10.9.2, pnpm 10.11.1, yarn 4.9.1)](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)
- [Cloudflare — Next.js framework guide (OpenNext adapter)](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare — Astro framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
- [Cloudflare — Hono framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/)
- [OpenNext — Cloudflare adapter docs](https://opennext.js.org/cloudflare)
- [React Router v7 announcement (formerly Remix)](https://remix.run/blog/react-router-v7)
- [Lucky Media — Remix / React Router framework review 2026](https://www.luckymedia.dev/insights/remix)
- [Software Thug — TanStack Start on Cloudflare Workers](https://www.softwarethug.com/posts/tanstack-start-cloudflare-workers-full-stack/)
- [PkgPulse — TanStack Start vs Remix 2026](https://www.pkgpulse.com/guides/tanstack-start-vs-remix-full-stack-react-2026)
- [Cloudflare Community — bun.lock not detected as tool](https://community.cloudflare.com/t/bun-not-detected-as-tool-when-using-new-bun-lock-instead-of-bun-lockb/779835)
- [Gist — getting bun.lock files to work with CF Workers CI](https://gist.github.com/danawoodman/d55995dec9e43433c6d426ea86c41513)
- [Docat — Multi-Tenant SaaS on Cloudflare Workers 2026](https://medium.com/@docat0209/how-to-build-a-multi-tenant-saas-on-cloudflare-workers-for-0-month-2026-8a0539c92a26)
