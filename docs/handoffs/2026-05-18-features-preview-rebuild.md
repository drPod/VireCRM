# Handoff — `/features` + `/preview` proper rebuild

**Started:** 2026-05-18 (Opus 4.7 1M, caveman mode)
**Status:** `/features` shipped (commit `81a35ac`). `/preview` rich modules pending.
**Why this exists:** prior session burned context on research subagents + skill bootstraps + brainstorm gate — handoff written before second half so next agent doesn't pay the same cost.

---

## Compact resume prompt

> Continue the `/features` + `/preview` rebuild from `docs/handoffs/2026-05-18-features-preview-rebuild.md`. `/features` is shipped. Now build the rich `/preview` demo modules + fix the ISSUES.md `/preview` bugs. Read the handoff, skip the brainstorm gate (already done), pick up at the "Next session work" list. Caveman mode, no fluff.

---

## What shipped this session

### `/features` — full rebuild (commit `81a35ac`)

Replaced landing-duplicate content with structured Linear/Attio-inspired narrative.

**Files created** (all under `src/components/marketing/features/`):

- `FeaturesHero.tsx` — large display headline, dual CTA, aurora glows
- `FeaturesNav.tsx` — sticky pill nav, IntersectionObserver-driven active state
- `ChapterDivider.tsx` — numbered chapter (`01 · CAPTURE`) divider
- `FeatureBlock.tsx` — shared block w/ `ProductMockFrame` (browser-chrome wrapper, aurora frame)
- `ComparisonTable.tsx` — Majix vs Spreadsheet vs Generic CRM vs White-label rivals (10 rows)
- `VerticalsStrip.tsx` — 6 industry cards (Energy / Solar / Real Estate / Insurance / Gym / General)
- `IntegrationsGrid.tsx` — 12 integration tiles (Stripe, Resend, Calendar, WhatsApp, etc.)
- `FeaturesFaq.tsx` — 8 Q&A accordion (setup time, pricing, data ownership, reseller, AI, migration, billing, refund)
- `ResellerCta.tsx` — separate from landing CTA — reseller angle
- `featureBlocks.tsx` — data: 3 chapters × 7 feature specs w/ bullets + mock components
- `mocks/CommandCenterMock.tsx` — command-bar + AI plan steps
- `mocks/FollowUpMock.tsx` — multi-channel sequence timeline
- `mocks/LeadScoringMock.tsx` — scored leads w/ explainable signals
- `mocks/InboxMock.tsx` — 2-pane chat w/ AI-drafted reply
- `mocks/CalendarMock.tsx` — week-view w/ booked meetings
- `mocks/AnalyticsMock.tsx` — SVG sparkline + funnel
- `mocks/WhiteLabelMock.tsx` — tenant list + theme swatches

Composed in `src/routes/features.tsx`. Hero → sticky nav → 3 chapters × feature blocks → comparison → verticals → integrations → FAQ → reseller CTA → footer.

Typecheck clean. Not browser-verified yet — flag for next session.

### Research artifacts

- Marketing research subagent ran, report in conversation transcript (line: "SaaS Marketing Feature Page Research"). Key takeaways adopted in `/features`:
  - Numbered chapter system (Linear `1.0/2.0/3.0`)
  - Bigger display type (`text-7xl` at lg, `text-[5.25rem]` at xl)
  - Product mocks via browser-chrome frame (Attio pattern, but HTML-rendered not screenshots)
  - Asymmetric CTAs, no sticky bottom bar
- Screenshots saved to `/tmp/genesisxsx-marketing-research/` (will be cleared on reboot — log only)

### Decisions made (don't re-litigate)

1. **Kept light-mode aurora aesthetic** for brand consistency with landing. Dark-mode is the "premium tier" SaaS default but switching costs landing/features visual cohesion. Aurora gradients + glassmorphism feel premium enough.
2. **HTML-rendered mocks, not screenshots.** Pros: scales w/ Tailwind dark mode, zero asset weight, no stale screenshots when UI changes. Cons: not the actual product UI. Mitigation: mocks pixel-mirror the real CRM design language (same `oklch` colors, same card style).
3. **No customer logo bar yet.** Need real client logos from user. Note in ISSUES.
4. **No testimonial pull-quote yet.** Same — need client copy.

---

## Next session work — `/preview` rich rebuild

Plan, copied from this session's task list (`Build rich /preview demo modules (9 modules)` + bug fixes).

### Phase 1 — split monolith

Current `src/routes/preview.tsx` is 1077 LOC with DashboardView inline + 13 PlaceholderView fallbacks. Split:

```
src/components/preview/
  LeadsView.tsx
  MessagesView.tsx
  CampaignsView.tsx
  WorkflowsView.tsx
  CalendarView.tsx
  EmailMarketingView.tsx
  RevenueView.tsx
  ReputationView.tsx
  AdvisorView.tsx
  AnalyticsView.tsx
  DashboardView.tsx        // extract existing
  PreviewLayout.tsx        // shell w/ shield + sidebar + topbar + tour
  data/                    // seeded data (leads, threads, campaigns, etc.)
```

Then `preview.tsx` becomes thin dispatcher: read `active` state, render matching view.

Already have:
- Read-only shield (`src/lib/preview/read-only-shield.ts`) — extends naturally
- Tour engine (`GuidedTour` in `preview.tsx`) — works, keep
- Banner system (`PreviewViewBanner` + `VIEW_BANNER_COPY`) — keep, already covers all 14 modules

### Phase 2 — build the 9 module views

Order by conversion impact (highest-first):

1. **LeadsView** — sortable/filterable table, 30 seeded leads, status filter chips, bulk-actions toolbar (disabled w/ tooltip). Crib data shape from `src/routes/_app.leads.tsx`.
2. **MessagesView** — 3-pane: thread list + active thread + AI-draft footer. Reuse `InboxMock` data shape; expand to ~12 threads w/ realistic timestamps.
3. **AdvisorView** — chat-style w/ canned prompt cards + 2 mocked exchanges. "Find me my hottest energy leads" → returns formatted list w/ reasoning.
4. **WorkflowsView** — visual node graph (Trigger → Filter → Action → Wait → Branch). Static SVG flow. List 4 example workflows: Welcome sequence, Re-engagement, Hot-lead notify, Birthday.
5. **CampaignsView** — card grid: 6 campaign cards w/ status badge, performance metrics (sent/opened/replied/booked), launched-date.
6. **CalendarView** — month grid (May 2026) w/ ~14 booked meetings, color-coded by type.
7. **RevenueView** — line chart (use `recharts`, already in `package.json` per shadcn `chart.tsx`) + P&L table + 12-month summary cards.
8. **EmailMarketingView** — list of email campaigns w/ subject lines + recipient counts + status.
9. **AnalyticsView** — pipeline funnel + reply-rate breakdown + rep performance. Crib from `AnalyticsMock` but make full-page.

Skip rebuilding Billing + Settings — keep `PlaceholderView` w/ honest "Sign up to access" copy.

### Phase 3 — fix existing `/preview` bugs

From ISSUES.md (lines 386, 919–925, 938):

- [ ] Honest copy: swap "X is part of the full CRM" → "Sign up to access X" in `PlaceholderView` (line 659)
- [ ] Dead Bell button on top bar (`preview.tsx:436-442`) — already has `aria-disabled` + `disabled` (line 446-447) but ISSUES claim it's still focusable real button doing nothing. Verify w/ AXTree.
- [ ] Settings sidebar `<div role="link">` (line 413-421) — convert to real `<button disabled>` or keep as nav and give it proper styling cue. ISSUES wants role/button.
- [ ] Button-in-anchor invalid HTML — `preview.tsx:347, 619, 653` — convert `<Link><Button>` → `<Button asChild><Link>`. Pattern already used elsewhere in file (line 631).
- [ ] `transition-all` → property-scope on `preview.tsx:970, 1016`.
- [ ] `cursor-default` mask on tour close-button — `preview.tsx:974` — drop, button is a real action target.
- [ ] Multi-state tab in URL — `useState("dashboard")` → `useSearch()` from TanStack Router for deep-link support per ISSUES line 938.

### Phase 4 — extend tour across new modules

Current tour has 4 steps, all on Dashboard + 2 placeholders. Extend to ~8-10 steps that walk through Leads → Messages → Workflows → Advisor → White-label. Each step now lands on a fully-built view, not a placeholder.

### Phase 5 — browser-verify

Per CLAUDE.md "verify before claiming done":

1. `bash scripts/restart-dev.sh` (handles stale-env Vite gotcha)
2. agent-browser session `genesisxsx-preview-verify` (separate from default)
3. Screenshot `/features` at 375 / 768 / 1280, scroll through all chapters + comparison + FAQ + reseller CTA
4. Screenshot `/preview` at same sizes, click every sidebar item, verify rich module renders (not PlaceholderView fallback)
5. AXTree pass for both pages — no `<div role="link">` violations, no missing labels, no orphaned `aria-disabled`
6. Console must be clean (no React key warnings, no missing prop warnings)

### Phase 6 — log to ISSUES.md

Append section `## 2026-05-18 — /features + /preview proper rebuild` with:
- What shipped (link to commits)
- Decisions made (chapter structure, HTML mocks, kept light-mode)
- What's still TODO (customer logos, testimonial copy, browser verification if skipped)
- Cross-cutting issues found

---

## Important context the next agent needs

### Project shape

- Multi-tenant CRM-as-a-Service. Client = reseller, her customers = white-labeled child workspaces. `/features` reseller CTA + `/preview` white-label module are **first-class product features**, not Lovable dead code.
- Stack: TanStack Start + Vite + Cloudflare Workers, Supabase Postgres, Stripe Connect, Anthropic SDK, Resend.
- ~50 auth-gated `_app.*` routes + ~20 marketing routes + API routes. See ISSUES.md route inventory (line 99).
- Bun 1.2+ uses text `bun.lock`, NOT `bun.lockb` binary. Workers Builds rejects binary lockfile.
- Vite bakes `VITE_*` env at startup — restart dev server after `.env` edits via `scripts/restart-dev.sh`.

### Design tokens (already loaded into context, summary)

- Color: lavender primary `oklch(0.55 0.18 290)`, accent `oklch(0.65 0.16 320)`, oklch throughout.
- Font: Inter (sans), JetBrains Mono (mono).
- Style: soft glassmorphism, aurora glows (conic gradient + blur), parallax hero, animated micro-interactions.
- Components: shadcn full library installed (`src/components/ui/`), including `accordion`, `table`, `tabs`, `sheet`, `command`. Use these — don't roll your own.
- Button has `variant="command"` (primary call-to-action gradient pill — `bg-primary/10 + glow-primary`).

### Read-only shield contract

`src/lib/preview/read-only-shield.ts` exports `shouldBlockClickEvent`, `shouldBlockKeyboardEvent`, `isAllowed`. Any interactive element on `/preview` that should remain functional MUST have `data-preview-allow="true"`. Default behavior: blocks + shows toast "Read-only preview — sign up to create real leads…". The shield is mounted at the wrapper level in `preview.tsx:367-369`. New module views inherit it automatically; don't re-wrap.

### Tour engine contract

`GuidedTour` in `preview.tsx:831` measures target via `document.querySelector(step.selector)`. Targets must have `data-tour="<id>"` attribute. Tour scrolls element into view + spotlight SVG mask + tooltip card. To extend tour, add steps to the `tourSteps` array at `preview.tsx:226` — each step has `{ tab, selector, title, body }` and `tab` auto-switches the active view before measuring.

### Skills + tools available

- `superpowers:brainstorming` — already invoked + gate skipped per user override. Don't re-invoke unless requirements shift.
- `ui-ux-pro-max:ui-ux-pro-max` — loaded but underused. Rule data was good (touch targets, contrast, animation timing). Reference for `/preview` verification.
- `web-design-guidelines` — for "review my UI" pass before claiming done.
- `frontend-design:frontend-design` — for fresh component builds. Optional, mocks are mostly done.
- Marketing research subagent already ran — synthesis in this doc. Don't re-run.
- agent-browser CLI (`mcp__claude-in-chrome__` if available, else `agent-browser`) for screenshot verification. Browser rule in `~/.claude/rules/browser.md` — session isolation required, never touch user's daily-driver Chrome.

### Commits already made

```
81a35ac feat(marketing): rebuild /features as proper deep-dive page
```

Pre-existing on `main` (don't touch):
- `wrangler.jsonc` has unstaged `preview_urls: false` change — not mine, leave alone.

### What NOT to do

- Don't re-run brainstorm gauntlet — user trusted me to execute, override per CLAUDE.md priority.
- Don't add customer logo bar or testimonial pull-quote w/o asking user for content. Both flagged.
- Don't switch `/features` to dark mode — decided against, keeps brand consistency w/ landing.
- Don't replace HTML-rendered mocks w/ screenshots — decided against, decoupling cost too high.
- Don't kill `/preview`. Existing tour engine + shield are good. Build modules on top.
- Don't rebuild Billing + Settings as rich modules. Keep upsell shells.

---

## Open questions for user

Before browser-verifying:

1. **Logo bar above the fold?** Need 5–8 real customer logos (SVG/PNG). Section is intentionally absent from `/features` right now — slot ready to drop in.
2. **Testimonial pull-quote?** One sentence + name + role + company from a current paying client. Section absent same reason.
3. **Comparison table — name competitors?** Currently labels are "Generic CRM" + "White-label rivals". User may want to name HubSpot / Pipedrive / GoHighLevel explicitly. Each row reflects published features but the legal angle is up to user.
