# React Router v7 (framework mode)

**Library:** React Router v7
**Snapshot:** 2026-05-22
**Source:** `https://reactrouter.com` (HTML site) backed by `https://github.com/remix-run/react-router/tree/main/docs` (raw markdown — what's mirrored here)
**Version tracked:** `react-router_7.9.4` (latest tag on context7 at snapshot time; HTML site reflects `main` branch)
**Mode:** Framework mode only (not library / declarative mode). We're on RR7 framework mode per `docs/decisions/02-frontend-stack.md`.

## When to use this folder

Agent / human about to write or modify any of:
- `src/app/routes/**` — route modules.
- `src/app/routes.ts` — central route config.
- `src/app/root.tsx` — root document, links, meta, error boundary.
- `react-router.config.ts` at repo root.
- `vite.config.ts` (`@cloudflare/vite-plugin` + `@react-router/dev/vite` integration).
- Any `loader` / `action` / `clientLoader` / `clientAction` / `meta` / `links` / `headers` / `ErrorBoundary` / `HydrateFallback` export.
- Form submission, navigation, redirects, data fetching, pending UI, suspense.

→ Read `README.md` (this file), pick the one or two files matching the task, read them. Don't WebFetch reactrouter.com, don't context7 — the answer is here, version-pinned.

## File map

`reference.md` is a context7 best-of dump (concatenated code samples). The rest are verbatim per-page mirrors from `github.com/remix-run/react-router/tree/main/docs/`. Filename convention: GitHub path with `/` → `__` (so `start/framework/routing.md` → `start__framework__routing.md`).

### `reference.md` (6.5KB)
- **Consult when:** want a quick code-sample index across many topics in one place.
- **Covers:** `routes.ts` with `index()` / `route()`, type-safe `loader` / `action`, HMR-compatible vs incompatible exports, `lazy` → `file` migration, `Route.LoaderArgs` / `Route.ComponentProps` from `+types`.

### Framework mode tutorial path (`start/framework/`)
Read these in order if onboarding to RR7 framework mode.

- **`start__framework__installation.md`** (1.0KB) — **consult when** scaffolding a fresh app. Covers `create-react-router@latest`, template list.
- **`start__framework__routing.md`** (8.8KB) — **consult when** writing or restructuring `routes.ts`. Covers `route()`, `index()`, `layout()`, `prefix()`, nested routes, dynamic segments, optional segments, splat, route file modules.
- **`start__framework__route-module.md`** (13.8KB) — **consult when** authoring any route file. Covers all route module exports: `default` component, `loader`, `clientLoader`, `action`, `clientAction`, `ErrorBoundary`, `HydrateFallback`, `headers`, `handle`, `links`, `meta`, `shouldRevalidate`. Most-touched single file.
- **`start__framework__rendering.md`** (1.6KB) — **consult when** picking SSR vs SPA mode or pre-rendering. Brief overview.
- **`start__framework__data-loading.md`** (5.5KB) — **consult when** writing a `loader` or `clientLoader`. Covers params, request, async data, error throws (`Response` throws for 404 etc.).
- **`start__framework__actions.md`** (4.1KB) — **consult when** writing an `action` for form submissions / mutations.
- **`start__framework__navigating.md`** (3.7KB) — **consult when** wiring `<Link>`, `<NavLink>`, `<Form>`, programmatic navigation via `useNavigate`.
- **`start__framework__pending-ui.md`** (3.3KB) — **consult when** adding loading states. Covers `useNavigation`, `useFetcher`, optimistic UI.
- **`start__framework__deploying.md`** (2.5KB) — **consult when** picking a deploy target. **CF Workers specifically:** points to `developers.cloudflare.com/workers/framework-guides/web-apps/react-router/` — that's the canonical CF integration ref, not here.
- **`start__framework__testing.md`** (4.9KB) — **consult when** writing route-module tests. `createRoutesStub`, Vitest setup.

### Framework conventions (`api/framework-conventions/`)
The "what file does what" canon for framework mode.

- **`api__framework-conventions__routes.ts.md`** (2.3KB) — **consult when** unsure what's allowed in `routes.ts`. The `RouteConfig` type + helpers.
- **`api__framework-conventions__root.tsx.md`** (6.3KB) — **consult when** editing the root document. Required exports (`Layout`, `default`), `Links` / `Meta` / `Scripts` / `ScrollRestoration` placement.
- **`api__framework-conventions__react-router.config.ts.md`** (6.3KB) — **consult when** changing `react-router.config.ts`. Covers `ssr`, `prerender`, `appDirectory`, `buildDirectory`, `future` flags, `serverBuildFile`, `presets`.
- **`api__framework-conventions__entry.server.tsx.md`** (6.6KB) — **consult when** customizing SSR entry (rare). Streaming, response, request handler.
- **`api__framework-conventions__entry.client.tsx.md`** (1.0KB) — **consult when** customizing hydration entry (rare).
- **`api__framework-conventions__server-modules.md`** (3.6KB) — **consult when** trying to keep code server-only (`.server.ts` files, tree-shaking).
- **`api__framework-conventions__client-modules.md`** (2.8KB) — **consult when** trying to keep code client-only (`.client.ts` files).

### Hooks (`api/hooks/`)
One-stop reference per hook. Read when API signature uncertain.

- **`api__hooks__useLoaderData.md`** (1.2KB) — `useLoaderData<typeof loader>()` for type inference.
- **`api__hooks__useActionData.md`** (1.4KB) — action result on the same route.
- **`api__hooks__useFetcher.md`** (2.4KB) — out-of-band loaders/actions (search, optimistic updates, multi-form pages).
- **`api__hooks__useNavigation.md`** (1.3KB) — global navigation state for pending UI.
- **`api__hooks__useNavigate.md`** (5.8KB) — programmatic navigation.
- **`api__hooks__useParams.md`** (2.6KB) — route params.
- **`api__hooks__useSearchParams.md`** (3.4KB) — URL search params (querystring state).
- **`api__hooks__useSubmit.md`** (1.0KB) — programmatic form submission.
- **`api__hooks__useRouteError.md`** (1.2KB) — error inside `ErrorBoundary`.
- **`api__hooks__useRevalidator.md`** (1.6KB) — force re-run all loaders.

### Components (`api/components/`)

- **`api__components__Form.md`** (5.3KB) — `<Form method="post" action="...">`. Most-used form primitive.
- **`api__components__Link.md`** (7.1KB) — client navigation.
- **`api__components__NavLink.md`** (8.3KB) — `<Link>` + active state.
- **`api__components__Outlet.md`** (1.2KB) — nested-route rendering slot.
- **`api__components__Meta.md`** (1.1KB) — renders `meta` exports in `<head>`.
- **`api__components__Links.md`** (1.6KB) — renders `links` exports in `<head>`.
- **`api__components__Scripts.md`** (1.5KB) — renders client bundle.
- **`api__components__ScrollRestoration.md`** (2.3KB) — restore scroll on navigation.

### Utils (`api/utils/`) — small but critical

- **`api__utils__redirect.md`** (1.5KB) — `redirect("/path", status?)` — throw from loaders/actions to redirect.
- **`api__utils__redirectDocument.md`** (1.8KB) — full-page redirect (no client nav).
- **`api__utils__replace.md`** (1.5KB) — redirect that doesn't push history.
- **`api__utils__data.md`** (1.3KB) — return non-2xx data response from loader/action without redirecting.
- **`api__utils__href.md`** (343B) — type-safe URL builder from route paths.
- **`api__utils__createCookie.md`** (262B) — cookie primitive.
- **`api__utils__createCookieSessionStorage.md`** (602B) — session storage backed by cookie.
- **`api__utils__isRouteErrorResponse.md`** (1.6KB) — narrow `unknown` to `Response`-style error in `ErrorBoundary`.

### Explanation (`explanation/`) — concepts, not API

- **`explanation__special-files.md`** (939B) — `entry.server.tsx`, `entry.client.tsx`, `root.tsx`, `routes.ts` overview.
- **`explanation__sessions-and-cookies.md`** (15.7KB) — **consult when** implementing auth / sessions. Big file, comprehensive.
- **`explanation__type-safety.md`** (2.4KB) — **consult when** confused about generated `.react-router/types/+types/*.ts`.
- **`explanation__hydration.md`** (1.2KB) — hydration model overview.

### How-to (`how-to/`) — task-oriented

- **`how-to__spa.md`** (4.8KB) — **consult when** setting `ssr: false` mode (relevant if we ever shift CRM to pure SPA).
- **`how-to__middleware.md`** (27.0KB) — **consult when** adding middleware (auth gates, logging). LARGEST file — has full API + examples.
- **`how-to__security.md`** (1.4KB) — CSRF, secrets in loaders, etc.
- **`how-to__file-route-conventions.md`** (16.2KB) — **consult when** using `@react-router/fs-routes` (filesystem-based routing) instead of explicit `routes.ts`.
- **`how-to__route-module-type-safety.md`** (3.4KB) — **consult when** wiring the `+types` import path; how `Route.LoaderArgs` etc. are generated.
- **`how-to__error-boundary.md`** (5.9KB) — patterns for `ErrorBoundary` exports.
- **`how-to__headers.md`** (4.0KB) — `headers` export for HTTP response headers + caching.
- **`how-to__meta.md`** (1.1KB) — `meta` export patterns.
- **`how-to__pre-rendering.md`** (8.7KB) — static pre-render at build time (config in `react-router.config.ts`).
- **`how-to__status.md`** (1.5KB) — setting HTTP status codes from loaders/actions.

### Upgrading

- **`upgrading__remix.md`** (13.9KB) — for porting Remix code (we have none; reference only).
- **`upgrading__v6.md`** (10.5KB) — for porting React Router v6 code (we have none; reference only).

## Maintenance

**Refresh:** run `scripts/sync-react-router-v7-docs.sh` from repo root. It re-pulls the curl pages + updates `_snapshot_date.txt`. The `reference.md` context7 dump must be refreshed separately from a Claude Code session (the MCP tool can't be invoked from a standalone shell — see comment block in sync script).

**Provenance:** every URL pulled is listed in `_urls.txt`.

**404 policy:** if upstream removes a page, the sync script will fail loudly (`curl -fsSL`) on that URL. Update the file list in the script and re-run.

## Why this exists (one-time, don't relitigate)

- Project lives on RR7 framework mode (CLAUDE.md, doc 02).
- `~/.claude/rules/docs.md` says: mirror docs for libraries we live in. RR7 qualifies.
- Bundle ~420KB markdown beats WebFetch per query: version-pinned, offline, lossless. Trade-off acceptable per the rule.
