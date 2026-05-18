# AGENTS.md

Routing index for AI agents (Claude Code, Cursor, Aider, OpenAI Codex, Copilot, etc). Tool-agnostic. Read this first, then jump to relevant file.

## What product is

White-label **CRM-as-a-Service**. Reseller `majix.ai` sells branded CRM instances to her customers. Multi-tenant. Each "resold org" = own hostname + theme + user pool + data. **Not single-tenant. Not SaaS for one company.**

Reseller path = core product. **Never strip "reseller-only" code in audits** — it's first-class. Surfaces: `is_reseller=true` org flag, `CustomDomainsPanel`, `EditClientWhiteLabelDialog`, `DomainHealthPanel`, `src/functions/custom-hostnames.functions.ts`, `docs/custom-domains/`.

## File map

| File | When to read |
|---|---|
| `ISSUES.md` | **Read `## Open` at session start.** Outstanding items + protocol. Append findings to `## Recent` before claiming done. |
| `README.md` | Setup, commands, deploy, layout. Human-facing entry. |
| `CLAUDE.md` | Project invariants + conventions + gotchas. Claude Code auto-loads; other agents read too. |
| `docs/issues-archive/YYYY-MM.md` | Cold history. Grep on demand for prior context (commits, prior bugs, root causes). |
| `docs/custom-domains/cf-for-saas-setup.md` | Cloudflare for SaaS runbook (reseller hostnames). |
| `docs/handoffs/` | Phase plans, migration logs (Vercel → CF, Lovable → owned stack). |
| `docs/UI_QA_CHECKLIST.md` | Manual UI QA checklist. |
| `wrangler.jsonc` | Worker config. Routes + vars + Supabase pub key. Secrets via `wrangler secret put`. |
| `supabase/migrations/` | DB schema source of truth. |

## ISSUES.md protocol (non-negotiable)

**At session start:** read `ISSUES.md` `## Open`. Lists: secrets/DNS the user owes, Phase 2 Lovable cleanup follow-ups, bugs found-not-fixed (file:line), verification debts, out-of-scope product calls. Transient categories (push-pending, in-flight audits) appear/vanish as work lands — read the live file.

**During work:**
- Found bug → append entry to `## Recent` (template in `ISSUES.md` "How to append"). Add to `## Open` "Bugs found, not fixed" if not fixing this session.
- Shipped fix → append `### Shipped` entry to `## Recent` with commit sha + verification evidence. Delete corresponding `## Open` item.
- Resolved an `## Open` user-action item → delete from `## Open`, note in `## Recent`.

**Strike-through (`~~…~~`) lives in `## Recent` only.** `## Open` is live state — items are either present or gone.

**Archive cutoff:** sections fully resolved AND >14 days cold → move to `docs/issues-archive/YYYY-MM.md` (append, never rewrite archive, newest on top, tag inline). Update `docs/issues-archive/README.md` table when creating a new month file. Don't let `ISSUES.md` exceed ~500 lines.

**Archive is queryable.** Before re-investigating something that "feels familiar," grep the archive:

```bash
grep -nE '\[cf-saas\]' docs/issues-archive/*.md      # all CF for SaaS work
grep -nE '\[security\]' docs/issues-archive/*.md     # all security passes
grep -n 'DomainHealthPanel' docs/issues-archive/*.md # every touch on a file
grep -n '2444041' docs/issues-archive/*.md           # find session by commit sha
```

Tag glossary + grep recipes + conventions in `docs/issues-archive/README.md`.

## Core invariants

**Vibe-coded origin.** Lovable artifact. Trust nothing existing. Verify before claiming working. Log every finding to `ISSUES.md`.

**Lookups: context7 first, training data never.** Before touching `wrangler.jsonc`, `@cloudflare/vite-plugin`, TanStack Start, Supabase JS, Stripe API, Bun lockfile — hit context7. Burnt-lesson: pushed `bun.lockb` binary, CF rejected ("outdated lockfile version"). context7 would've flagged `bun.lock` text default since Bun 1.2. Don't repeat.

**Supabase CLI > MCP.** Prefer `supabase ...` CLI over `mcp__plugin_supabase_supabase__*`. CLI auth via `SUPABASE_ACCESS_TOKEN`. No context-token cost.

**Vite env baked at startup.** Edit `.env` → restart dev server. HMR won't pick up env. Stale-env symptom = silent login fail. Use `scripts/restart-dev.sh`.

**Bun lockfile = text.** `bun.lock` (text) yes. `bun.lockb` (binary) no — CF Workers Builds rejects under `--frozen-lockfile`.

**Surgical edits.** Touch request scope only. Don't refactor unbroken code. Match repo conventions over personal preference.

**Root cause, not symptom.** Don't suppress errors. No silent fallbacks — raise loudly. Workaround needed → flag tech debt + `TODO(): remove once X`.

## Skills (Claude Code + others)

Project skills pinned in `skills-lock.json`. Reproduce on fresh clone:

```bash
npx -y skills@latest experimental_install
```

Bundled: TanStack Start/Router/Query/Integration, Stripe (best-practices/projects/upgrade), Resend (`resend`/`react-email`/`email-best-practices`), `web-design-guidelines`. Supabase + shadcn + Vercel ship via Claude Code **plugins** (auto-updated) — don't duplicate via `skills add`.

## Hosts (don't confuse)

Hostname plan designed 2026-05-18 — Worker routes bound in `wrangler.jsonc`, DNS records still pending at CF dashboard.

- `majix.ai` + `www.majix.ai` — Public marketing (landing, pricing, signup CTA). Worker route bound; DNS pending.
- `app.majix.ai` — Central CRM landing + auth callbacks + Majix platform admin (operator surface). Worker route bound; DNS pending.
- `<slug>.majix.ai` — Per-tenant white-label CRM (free tier, every tenant gets one at signup). Wildcard route bound; wildcard DNS + cert pending.
- `customers.majix.ai` — CF for SaaS fallback for custom hostnames. Infra-only, never user-visible. Live.
- `notify.majix.ai` — Resend sender. Verified, live.
- `genesisxsx.darsh-pod.workers.dev` — Worker subdomain (dev/preview). Stays as escape hatch.

Reserved subdomain labels (never tenant slugs): `app`, `www`, `customers`, `notify`, `api`, `admin`, `mail`. Enforced in `get_org_by_domain` migration + `DomainBrandingProvider` `SYSTEM_HOST_PATTERNS`.

Tenant theming resolves via `get_org_by_domain(host)` — matches `custom_domain` for premium-tier hostnames, slug match for `<slug>.majix.ai` subdomains. Both paths return a `DomainBranding` JSON blob; `DomainBrandingProvider` applies theme client-side.

## Verify before claiming done

No "complete"/"fixed"/"passing" without evidence. Run `bun run typecheck` + `bun run lint` + `bun run test`. UI changes → screenshot or live verify. Can't verify → say so. Don't ship optimism.

## Where to append findings

`ISSUES.md` — top of file (newest first), dated section header (`## YYYY-MM-DD short title`), terse caveman body. Cross-link to commit sha when applicable.
