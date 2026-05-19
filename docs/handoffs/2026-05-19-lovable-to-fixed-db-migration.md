# Handoff — Lovable → fixed-DB data migration

**Started:** 2026-05-19 (Opus 4.7 1M, caveman mode)
**Status:** plan written + investigation done, nothing executed yet
**Why this exists:** old Lovable Supabase project still has the live, real data for Green EnergiAi (Crystal Cameron + Caziah Cameron + 4 staff). The current `coynbufhejaeuifpvmvw` project is a fresh shell. Cutover hasn't happened. Caziah signed in to the OLD project on 2026-05-19 01:05 — the migration window is short.

This handoff supersedes the Crystal-onboarding handoff (`docs/handoffs/2026-05-18-green-energiai-onboarding.md`) for the next session. That doc is **paused** — finish migration first, then resume Crystal onboarding from a clean post-migration state.

---

## Compact resume prompt

> Continue the Lovable→fixed-DB migration from `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md`. Read handoff, jump to **"What's done / what's next"**, pick first unchecked step. Caveman mode. Don't re-litigate decisions in **"Decisions locked"**. Strategy is **enrich, not replace** — old DB is the truth for users + lead UUIDs; xlsx is supplement for energy fields the old importer dropped. Append progress to handoff before context fills.

---

## Context

- **Old Lovable Supabase project:** ref TBD — fetch from `supabase projects list --token "$SUPABASE_ACCESS_TOKEN"` or the Lovable dashboard. Project lives separately from `coynbufhejaeuifpvmvw`.
- **New current project:** `coynbufhejaeuifpvmvw` (`https://coynbufhejaeuifpvmvw.supabase.co`). This is what `VITE_SUPABASE_URL` points at.
- **Data source:** `og_database/` (gitignored, never commit — bcrypt PII):
  - `genesis_auth_data.sql` — 47k, 23 `auth.users` INSERTs with `password_hash` (use these to preserve UUIDs + passwords)
  - `genesis_database_schema.sql` — 382k, schema-only DDL
  - `genesis_database_full.sql` — 3.4M, schema + `COPY public.* FROM stdin` data
  - `genesis_database_full_with_auth.sql` — 3.4M, all of the above
- **Supplement source:** `Copy of NGP MASTER LIST - Copy.xlsx` (gitignored, repo root). 5446 rows. Crystal's NGP master spreadsheet with energy fields (ESI, agent_mils, contract_start_date, cost_per_kwh, supplier, etc) the OLD DB never captured.

## Key findings from old-DB skim

1. **Crystal already has an `auth.users` row on the old DB.** id `7ba2ebfa-9d24-4231-ba25-ea463f30587c`, email `crystal@greenenergiai.com`, confirmed 2026-04-23 16:37. Bcrypt password hash present.
2. **The 2026-05-18 session-1 provisioning created a DUPLICATE Crystal on new DB.** id `b5ae0c3e-1655-48d5-b211-a9fd55aaafea`. **Decision: delete the new-DB Crystal + the new-DB org + all 3850 bad-mapping leads, then port old DB forward verbatim.** Preserves the old UUID + email-history + any future-foreign-key reference.
3. **Caziah Cameron owns the Green EnergiAi org on old DB, not Crystal.** Old org id `8b8c76ab-08de-4fd1-a703-b06138078181`, name "Caziah Cameron's Organization", brand "Caziah's CRM", slug `caziah-cameron-66e0f158`, `is_reseller=t`. Crystal + Erica + Shelby + mleaverton are members under Caziah's org. New DB has the org owned by Crystal under a fresh id — wrong structure. **Decision: migration carries old org structure forward; Caziah remains owner; old org-id reused; old slug reused (or rebranded to `greenenergiai` post-migration, see "Open questions").**
4. **Real Green EnergiAi staff to port:** crystal, erica, shelby, mleaverton (`@greenenergiai.com`), cameroncaziah, caziahbankss (`@gmail.com`).
5. **Founder accounts to port:** ethansereti, esereti22 (`@gmail.com`).
6. **Other real accounts on old DB:** alexanderjakari, davioncarr60, info.solace05, jesaira.lifosjoe12, paparusse02, primeframem (`@gmail.com`). Confirm with user whether these are testers / employees / customers before porting; some may be safe to drop.
7. **Test/audit accounts to SKIP:** `qa-*@example.com`, `audit+*@example.com`, `e2etest*@example.com`, `testcrm@example.com` (5 users).
8. **Old DB `public.leads` row count for Crystal's org:** **5389 rows.** Source = `xlsx_import` from 2026-04-29 (Crystal's earlier failed import that landed name/email/phone/company but NOT energy fields). Examples: CHAD BULLARD (VENTURE CHURCH GLOBAL, chad.bullard@venturechurch.net, 817-482-6999) — basic CRM fields present, energy fields NULL. **Plus duplicates** — CHAD BULLARD has 3 rows. Crystal hit Import multiple times; dedupe required.
9. **Old DB `public.contract_requests` for Crystal's org:** empty (table has energy fields but Crystal never populated it).
10. **Schema diverged on `leads`.** Old DB: `id, organization_id, name, email, phone, company, status, score, source, last_contact, next_action, notes, created_at, updated_at, deal_value_cents, deal_currency, closed_at, closed_by_user_id, annual_kwh, contract_end_date, current_supplier, assigned_to, created_by, deleted_at, score_reason, tags`. New DB additionally has: `service_address, esi_id, title, deal_name, contract_start_date, cost_per_kwh, agent_mils, commission_value` (added in `20260518200618_energy_broker_fields.sql`). Migration writes nulls for the new columns on port, then xlsx-supplement step fills them.

## Strategy: enrich, not replace

Three layers, in order:

1. **Old DB → new DB verbatim.** Preserve UUIDs everywhere (auth.users, organizations, leads, etc). Adapt to new schema (additional columns get NULLs).
2. **xlsx → new DB enrich pass.** For each xlsx row, match against new DB leads on `(name + email + phone)` or `(esi_id)` (xlsx column = `Meter Number`, strip backticks). When match: UPDATE the lead with energy fields (ESI, agent_mils, contract_start_date, cost_per_kwh, contract_end_date, current_supplier, service_address from composite of address_1/street_name/city/state/postcode, title from `designation`, etc). When NO match: INSERT new lead with `status='won'` (historical backfill mode).
3. **Verification + cutover.** Crystal logs in to new DB with her OLD password (bcrypt preserved). Confirms her data. Old DB frozen + DNS-redirected if any remains.

## Decisions locked (don't re-litigate)

1. **Strategy = enrich, not replace.** Old DB is source of truth for auth.users + org membership + lead UUIDs. xlsx is supplement for energy-broker fields the old importer dropped. Both must run; neither alone is sufficient.
2. **Preserve UUIDs.** auth.users.id, organizations.id, leads.id — all carried forward verbatim. Avoids breaking any future foreign-key reference and lets Crystal log in with her existing password.
3. **Bcrypt hashes ported via Supabase Admin API.** `POST /auth/v1/admin/users` accepts `password_hash` (bcrypt). Old DB hashes work directly — no password reset, no friction for Crystal.
4. **Test/audit accounts NOT ported.** Filter out `qa-*@example.com`, `audit+*@example.com`, `e2etest*`, `testcrm@example.com`. Re-mint if needed for QA on new DB.
5. **Caziah owns the org, not Crystal.** Match old DB structure. `is_reseller` flag preserved (false in new DB convention; old says `t` but the flag is legacy/dormant per CLAUDE.md "Legacy reseller code" — flip to `f` during port).
6. **3850 bad-mapping rows on new DB get WIPED** before migration runs. They were a session-2 test import with broken column mapping; superseded by the migration's enrich pass. SQL: `DELETE FROM public.leads WHERE organization_id = 'c31c2a18-f595-499d-9353-f3cd1d9e659b';` then `DELETE FROM auth.users WHERE id = 'b5ae0c3e-1655-48d5-b211-a9fd55aaafea';` then `DELETE FROM public.organizations WHERE id = 'c31c2a18-f595-499d-9353-f3cd1d9e659b';` (RLS cascades + handle_new_user trigger don't auto-clean; manual order: leads → user_roles → org → auth.users).
7. **xlsx parsing logic moved out of the dialog into a standalone migration script.** The in-app `ImportLeadsDialog` heuristics + AI mapper still need a separate fix for future Crystal-uploads, but for THIS migration the parser lives in `scripts/migrate-lovable-to-fixed.ts` so we can iterate without rebuilding the bundle.
8. **Crystal's NGP xlsx column vocabulary is known.** Headers: `Customer Name` (company), `Meter Number` (ESI in backticks), `Supply Type`, `Unit Uplift` (mils, e.g. 0.041 — NOT 505), `EAC AQ` (annual_kwh, e.g. 16988), `Meter Consumption`, `Start Date`, `End Date`, `Supplier`, `contact_person` (name = human), `designation` (title), `customer_email` (email), `telephone` (phone), `address_1`/`address_2`/`street_name`/`street_no`/`city`/`state`/`postcode` (composite service_address). No `cost_per_kwh` column in xlsx (skip).
9. **xlsx-supplement matches on `Meter Number` (ESI) when present.** ESI is meter-unique and stable. Fall back to `(contact_person + customer_email)` when ESI missing. Strip surrounding backticks before compare.
10. **Migration script idempotent.** Re-running on a clean new DB produces the same result. Re-running on a partially-migrated DB skips already-ported rows (UUID conflict → ON CONFLICT DO NOTHING + UPDATE).
11. **DNS cutover deferred.** Don't touch the old Lovable Supabase project's URL or any redirect during migration. Old project stays read-only after final port (revoke writes via service-role) — separate step gated on Crystal confirming on the new DB.

## What's done / what's next

Format: each item `[ ]` (pending) → `[~]` (in progress) → `[x]` (done, with commit sha). Append findings under the item — don't delete past notes.

### Step 0 — Recover old project ref + service-role key `[ ]`

- [ ] Get the old Lovable Supabase project ref. Options: (a) `supabase projects list --token "$SUPABASE_ACCESS_TOKEN"`, (b) Supabase dashboard, (c) ask user.
- [ ] Get the old project's service-role key (Supabase dashboard → Settings → API). Add to `.env.migration` (gitignored, never commit) as `OLD_SUPABASE_URL` + `OLD_SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Smoke test the connection: `curl -s "$OLD_SUPABASE_URL/auth/v1/admin/users?per_page=1" -H "Authorization: Bearer $OLD_SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $OLD_SUPABASE_SERVICE_ROLE_KEY" | python3 -m json.tool | head -20`. Confirms key + URL.

### Step 1 — Clean slate on new DB `[ ]`

- [ ] Delete the session-1 Crystal + her duplicate org + the 3850 bad-mapping leads. Use Supabase CLI `db query`:
  ```sql
  DELETE FROM public.leads WHERE organization_id = 'c31c2a18-f595-499d-9353-f3cd1d9e659b';
  DELETE FROM public.user_roles WHERE organization_id = 'c31c2a18-f595-499d-9353-f3cd1d9e659b';
  DELETE FROM public.profiles WHERE user_id = 'b5ae0c3e-1655-48d5-b211-a9fd55aaafea';
  DELETE FROM public.organizations WHERE id = 'c31c2a18-f595-499d-9353-f3cd1d9e659b';
  ```
- [ ] Delete Crystal's duplicate auth.users row via Admin API:
  ```bash
  curl -X DELETE "$SUPABASE_URL/auth/v1/admin/users/b5ae0c3e-1655-48d5-b211-a9fd55aaafea" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
  ```
- [ ] Verify clean: `supabase db query --linked "SELECT count(*) FROM public.leads WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'green%' OR slug LIKE 'caziah%');"` should return 0.

### Step 2 — Write the migration script `[ ]`

File: `scripts/migrate-lovable-to-fixed.ts`. Bun-runnable. Uses `@supabase/supabase-js` against BOTH projects.

- [ ] Load `OLD_*` + new (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) from env.
- [ ] **Phase A — auth.users.** For each old `auth.users` row (filter out test/audit accounts), call `POST /auth/v1/admin/users` on new project with same `id`, `email`, `password_hash`, `email_confirmed_at`, `raw_user_meta_data`, `raw_app_meta_data`. Test with `ON CONFLICT` — re-run safe.
- [ ] **Phase B — organizations.** Port old `organizations` rows verbatim, mapping schema diff (new DB may have columns old doesn't, vice versa — `ALTER TABLE` not in scope, just `INSERT … ON CONFLICT (id) DO UPDATE`). For Crystal's org: rename slug from `caziah-cameron-66e0f158` to `greenenergiai` to match the `greenenergiai.majix.ai` subdomain (already in `wrangler.jsonc`). Set `is_reseller=false` (legacy flag, dormant).
- [ ] **Phase C — user_roles / profiles.** Port org-membership tables. Caziah = owner. Crystal + Erica + Shelby + Mleaverton = members.
- [ ] **Phase D — leads.** Port `public.leads` for Crystal's org (`8b8c76ab-…`) verbatim. UUIDs preserved. New-DB-only columns (`service_address`, `esi_id`, `title`, `deal_name`, `contract_start_date`, `cost_per_kwh`, `agent_mils`) get NULL.
- [ ] **Phase E — other-table data.** Walk every `COPY public.* FROM stdin` block in `genesis_database_full.sql`. For each non-empty block: read schema diff, transform if needed, INSERT with ON CONFLICT DO NOTHING.
- [ ] **Phase F — xlsx supplement.** Parse `Copy of NGP MASTER LIST - Copy.xlsx` via SheetJS. For each row: build energy-field patch (ESI strip-backticks, `Unit Uplift` → agent_mils, `EAC AQ` → annual_kwh, dates parsed, address composite). Match against new-DB leads on `esi_id` (preferred) or `(contact_person + customer_email)`. If matched: UPDATE the energy fields on the existing row. If unmatched: INSERT new lead with `status='won'`, `source='xlsx_supplement'`.
- [ ] **Idempotency check.** Re-run end-to-end against a freshly-cleaned new DB twice. Same final state.

### Step 3 — Dry run on a Supabase branch `[ ]`

- [ ] Spin a Supabase branch via CLI: `supabase branches create migration-dryrun --project-ref coynbufhejaeuifpvmvw`. Branch gets its own ref + URL.
- [ ] Point script at the branch (`SUPABASE_URL` = branch URL).
- [ ] Run end-to-end migration. Inspect counts:
  - auth.users: expected ~14 (18 real - 5 test/audit, double-check the personal-address ones with user)
  - organizations: expected ~10 (filter audit/qa orgs)
  - leads on Crystal's org: ~5389 from old DB + ~50 xlsx-only INSERTs ≈ confirm
  - leads with `agent_mils IS NOT NULL`: ~5389 (all old-DB rows get xlsx-enriched on ESI match)
- [ ] Spot-check 10 random Crystal leads — `name`, `email`, `phone`, `esi_id`, `agent_mils`, `annual_kwh`, `current_supplier`, `contract_start_date`, `contract_end_date`, `service_address` all populated correctly.
- [ ] Delete the branch when satisfied: `supabase branches delete migration-dryrun`.

### Step 4 — Production run `[ ]`

- [ ] Run the SAME migration script against production new DB.
- [ ] Same verification queries.
- [ ] Append result + row counts + commit sha to ISSUES.md `## Recent`.

### Step 5 — Resume Crystal onboarding `[ ]`

After migration is green, jump back to `docs/handoffs/2026-05-18-green-energiai-onboarding.md`. Crystal can sign in with her OLD password on `greenenergiai.majix.ai`. The Step 8 magic-link DM in that handoff still applies, but reframe — instead of "I provisioned a new account for you", it's "your account is live on the new system, sign in with your existing password, all your data carried over, plus new energy-broker fields now populated from the master spreadsheet."

### Step 6 — Freeze old Lovable project `[ ]`

- [ ] Confirm Crystal + Caziah have both logged into the new DB successfully.
- [ ] On old Lovable project: revoke the service-role key (Supabase dashboard) — also rotates anon key. Any client still pointing at old project goes 401.
- [ ] Lovable-side: take down their preview if it still serves traffic (`genesisx.space` per CLAUDE.md). DNS already moved to majix.ai per 2026-05-18 work, but verify.
- [ ] Optional: archive old project. Supabase pause vs delete is a one-way door — keep paused for 30d before deletion in case rollback needed.

---

## Don't do (anti-patterns for next agent)

- ❌ **Don't run the migration against production new DB without a successful branch dry-run.** UUID collisions or schema-diff bugs would corrupt the new DB. Branch first.
- ❌ **Don't `cat` the dump files into context.** Auth file is 47k of bcrypt hashes; full dumps are 3.4M each. Use targeted `grep` / `sed` / `awk` per `awk '/^COPY .../,/^\\\.$/'` pattern.
- ❌ **Don't commit dump files or `.env.migration`.** Both gitignored. Re-verify with `git check-ignore` if uncertain.
- ❌ **Don't drop / re-create Crystal's account just because UUID conflict.** Preserve her old UUID + bcrypt hash. The Step 1 cleanup deletes the NEW-DB duplicate (`b5ae0c3e-…`), NOT the old one.
- ❌ **Don't manually email Crystal mid-migration.** The old DB is still live for Caziah; if Crystal logs in there during the cutover she'll see frozen state once Step 6 lands. Coordinate via Step 5/6 ordering.
- ❌ **Don't trust the existing `ImportLeadsDialog` heuristics for Crystal's xlsx.** They mis-map `Unit Uplift` to a different column (session-2 result: agent_mils=505 instead of 0.041). The migration script writes its own parser — do not re-use the dialog code path.
- ❌ **Don't dispatch parallel subagents to write the migration script.** Single-file, single-author. Subagents OK for grep-old-DB / count-rows research only.

---

## Open questions

1. **Is the old Lovable Supabase project paid or free tier?** Affects rollback window. Free tier projects auto-pause after 7d idle, paid don't.
2. **Are the 6 personal-Gmail accounts (alexanderjakari, davioncarr60, info.solace05, jesaira.lifosjoe12, paparusse02, primeframem) real customers, real staff, or testers?** Filter accordingly. Cheapest path: ask the user.
3. **Should the org-slug rename `caziah-cameron-66e0f158` → `greenenergiai` happen as part of migration, or after?** Doing it during migration breaks any old links/screenshots Caziah may have bookmarked; doing it after means a transitional period where the org slug doesn't match the subdomain. Recommend: rename during migration; her bookmarks at `caziah-cameron-66e0f158.majix.ai` (if any) 404 — that subdomain was never actually wired anyway.
4. **Custom-domain rows in old DB?** Check `organizations.custom_domain` + `org_custom_domains` table for any tenant that paid for a custom hostname pre-migration.
5. **`commission_earnings` / `commission_rules` data in old DB?** If any, port; if not, skip (legacy reseller-scaffold tables).
6. **Old DB `contract_requests` is empty for Crystal — confirm.** If non-empty for any other org, port that data.
7. **Crystal's xlsx is the only supplement source — or are there others?** User to confirm. Other tenants might have their own master lists waiting.

---

## Verification checklist (run before claiming any step done)

- [ ] `bun run typecheck` clean (only if script touched TypeScript types).
- [ ] Migration script idempotent: run twice against clean branch, same final state both times.
- [ ] Row counts on new DB match expected: auth.users (~14), organizations (~10), Crystal's leads (~5389 from old + xlsx-only INSERTs).
- [ ] Spot-check 10 Crystal leads: all energy fields populated where xlsx had data.
- [ ] Crystal can sign in to `https://greenenergiai.majix.ai/login` with her OLD bcrypt password (or magic-link as fallback).
- [ ] ISSUES.md `## Recent` appended with commit sha + row counts.

---

## Glossary

- **Enrich vs replace:** "enrich" = preserve old DB rows + UUIDs + auth; UPDATE existing rows with xlsx data. "Replace" = wipe new DB, ingest xlsx fresh. We pick enrich because (a) preserves Crystal's existing UUID + password (zero friction sign-in), (b) preserves any future-foreign-key reference, (c) xlsx alone misses some old-DB rows that didn't make it back to the spreadsheet.
- **ESI / ESID:** 17-digit Electric Service Identifier. Texas meter unique. Crystal's xlsx wraps in literal backticks (`` `10443720…` ``) — strip on parse.
- **Mils:** thousandths of a dollar. xlsx column = `Unit Uplift` (e.g. 0.041 = 0.041 mils = $0.000041/kWh).
- **Annual usage (kWh):** xlsx column = `EAC AQ` (Estimated Annual Consumption / Annual Quantity).
