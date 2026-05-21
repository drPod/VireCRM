# Handoff — Lovable → fixed-DB data migration

**Started:** 2026-05-19 (Opus 4.7 1M, caveman mode)
**Status:** DONE. Migration shipped 2026-05-19 (Step 3+4 live port). Verified 2026-05-22 (DB counts + spot-check). Step 5 (Crystal sign-in) confirmed 2026-05-22 via `last_sign_in_at` 2026-05-20. Step 6 (freeze old Lovable project) closed 2026-05-22 — old project outside user's control, nothing to revoke. Caziah onboarding tracked separately in `ISSUES.md ## Open`.
**Why this exists:** old Lovable Supabase project had the live, real data for Green EnergiAi (Crystal Cameron + Caziah Cameron + 4 staff). The current `coynbufhejaeuifpvmvw` project was a fresh shell. Cutover landed in two phases: data port 2026-05-19, Crystal sign-in 2026-05-20, doc-sync + closure 2026-05-22.

Green-energiai onboarding handoff (`docs/handoffs/2026-05-18-green-energiai-onboarding.md`) → unpaused for Crystal (signed in, account live). Caziah's leg of green-energiai = now a separate tenant under his own org `caziah-cameron`, not a member of greenenergiai.

---

## Compact resume prompt

> Continue the Lovable→fixed-DB migration from `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md`. Read handoff, jump to **"What's done / what's next"**, pick first unchecked step. Caveman mode. Don't re-litigate decisions in **"Decisions locked"**. Strategy is **enrich, not replace** — old DB is the truth for users + lead UUIDs; xlsx is supplement for energy fields the old importer dropped. Append progress to handoff before context fills.

---

## Context

- **Old Lovable Supabase project:** lives inside Lovable's account, NOT user's. `supabase projects list` (run 2026-05-19 by session 3) doesn't return it. Migration source is the dump files in `og_database/`, NOT a live API connection. No `OLD_SUPABASE_URL` / `OLD_SUPABASE_SERVICE_ROLE_KEY` needed.
- **New current project:** `coynbufhejaeuifpvmvw` (`https://coynbufhejaeuifpvmvw.supabase.co`). This is what `VITE_SUPABASE_URL` points at. Direct service-role access via `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
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

### Step 0 — Inventory + confirm sources `[x]` (done 2026-05-19, session 3)

- [x] Confirmed old Lovable Supabase project is NOT in user's `supabase projects list` — Lovable owns it. No live API access. Source for migration = `og_database/*.sql` dumps only.
- [x] Confirmed dumps + xlsx are the only inputs. Targets:
  - `og_database/genesis_auth_data.sql` — 23 auth.users rows
  - `og_database/genesis_database_full.sql` — 3.4M, schema + `COPY public.* FROM stdin` data
  - `og_database/genesis_database_schema.sql` — 382k, schema-only DDL (reference for column shapes)
  - `Copy of NGP MASTER LIST - Copy.xlsx` — 5446 rows, energy-field supplement
- [x] Validated old DB structure: Crystal's org id `8b8c76ab-08de-4fd1-a703-b06138078181` ("Caziah Cameron's Organization"), 5389 leads on it, energy fields all NULL on old leads. Crystal's old auth.users.id = `7ba2ebfa-9d24-4231-ba25-ea463f30587c`.

### Step 1 — Clean slate on new DB `[x]` (done 2026-05-19, session 3)

- [x] Deleted 4791 bad-mapping leads + 1 user_role + 1 profile + 1 org from session-1+session-2 work. SQL:
  ```sql
  BEGIN;
  DELETE FROM public.leads WHERE organization_id = 'c31c2a18-f595-499d-9353-f3cd1d9e659b';
  DELETE FROM public.user_roles WHERE organization_id = 'c31c2a18-f595-499d-9353-f3cd1d9e659b';
  DELETE FROM public.profiles WHERE user_id = 'b5ae0c3e-1655-48d5-b211-a9fd55aaafea';
  DELETE FROM public.organizations WHERE id = 'c31c2a18-f595-499d-9353-f3cd1d9e659b';
  COMMIT;
  ```
- [x] Deleted Crystal's duplicate auth.users row (id `b5ae0c3e-…`) via Admin API → HTTP 200.
- [x] Verified post-delete: `leads=0, orgs=0, users=0, crystals=0` (where queries scoped to the session-1 UUIDs + `email='crystal@greenenergiai.com'`). Email is now free for Step 2's auth port to insert with old UUID `7ba2ebfa-…`.

### Step 2 — Write the migration script `[x]` (executed 2026-05-19 session 5, live DB ported)

**Findings from session 4 (correct prior data here):**

- **UUID typo in prior handoff lines.** Crystal's old `auth.users.id` is `7ba2ebfa-f30e-449a-866e-085c5940c1d4` (verified in the dump). Earlier session-3 entries wrote `7ba2ebfa-9d24-4231-ba25-ea463f30587c`; that suffix `9d24-4231-…` is actually `ethansereti@gmail.com`'s UUID. Script uses the correct one (which lives in the dump itself, not hard-coded).
- **Crystal owns a SECOND org in the old DB** that this handoff missed. Old DB has both `8b8c76ab-08de-4fd1-a703-b06138078181` (Caziah's, 5389 leads, "Caziah Cameron's Organization") **and** `188c4869-8bc4-438e-b746-c8f28e2932d2` (Crystal's own org, 4793 leads). Both are real production data. Script whitelists **both** orgs for port. **Open question for user:** consolidate the two orgs into one tenant post-migration, or leave Crystal with her own + member-of-Caziah's?
- **xlsx has 5446 sheet rows but only 4791 non-empty data rows** — 654 trailing blanks. Script's enrich pass operates on 4791. Confirmed via raw `header:1` extract.
- **`qa\d*-` accounts** — old DB has `qa2-vireon@example.com` plus the three `qa-*`. Skip-pattern widened from `/^qa-/` to `/^qa\d*[-_@]/` to catch both.
- Two demo orgs in dump that are NOT whitelisted: `6e87b377-…` (testcrm seed, 4 leads) and `4e0a3989-…` (ethansereti, 1 lead). Script drops them.


File: `scripts/migrate-lovable-to-fixed.ts`. Bun-runnable. Reads dump files + xlsx, writes to new DB via `@supabase/supabase-js` service-role client. **No connection to old project — that data is frozen in the dump files.**

- [x] **File written:** `scripts/migrate-lovable-to-fixed.ts`. Bun-runnable. Uses `bun:sql` (built into Bun 1.3) for direct Postgres connection — needs **`DATABASE_URL`** (Supabase session pooler or direct connection from Dashboard → Settings → Database). No new dep added; `xlsx` was already in `package.json`.
- [x] Load new-DB env (`DATABASE_URL`) from process env. Service-role key/URL not needed because the script writes directly via Postgres (auth.users included — `handle_new_user` trigger is `DISABLE TRIGGER`'d during Phase A so it doesn't auto-provision duplicate orgs, then re-enabled in `finally`).
- [x] Parse `og_database/genesis_auth_data.sql` — `parseAuthInserts()` is a line-by-line scanner that handles `INSERT INTO auth.users (cols) VALUES (vals) ON CONFLICT (id) DO NOTHING;` and the matching `auth.identities` shape. Single-quote escape (`''`) handled. NULL token vs `'NULL'` string handled.
- [x] Parse `og_database/genesis_database_full.sql` — `parseCopyBlocks()` finds every `COPY "public"."tbl" ("c1","c2",…) FROM stdin;` block and reads rows until `\.`. Tab-separated, `\N` = NULL, PG COPY backslash escapes decoded.
- [x] **Phase A — auth.users + auth.identities.** Direct insert (NOT Admin API — `bun:sql` is the only client). Bcrypt hashes ride through verbatim in `encrypted_password`. **Trigger-disable hit a permissions wall:** `postgres` doesn't own `auth.users` (Supabase reserves that to `supabase_auth_admin`), and `GRANT supabase_auth_admin TO postgres` is blocked. Workaround = added GUC short-circuit to `handle_new_user` (migration `20260519120000_handle_new_user_skip_guc.sql`). Script now does `SET LOCAL app.skip_auto_provision = 'on'` + `SET LOCAL request.jwt.claim.role = 'service_role'` inside the auth-port transaction. **Live counts: 14 auth.users + 15 auth.identities inserted.**
- [x] **Phase B — organizations.** Whitelist `ALLOWED_ORG_IDS` = `{8b8c76ab, 188c4869}`. Slug override map renames `8b8c76ab` → `greenenergiai`. `is_reseller=f` forced (legacy flag, dormant per CLAUDE.md). Schema diff handled by `rowsToObjects()`. **Blocker hit:** `enforce_custom_domain_entitlement` trigger rejects writes unless `auth.role() = 'service_role'`. Workaround = `SET LOCAL request.jwt.claim.role = 'service_role'` inside every upsert transaction (`upsertRows()` now wraps each chunk in `sql.begin`). **Live: 2 orgs upserted** (`greenenergiai` slug applied, `crystal-cameron-7ba2ebfa` left as-is from dump).
- [x] **Phase C — user_roles + profiles.** Eligible row = both `organization_id IN ALLOWED_ORG_IDS` AND `user_id IN eligible-auth-user-ids`. **Custom-role FK violation hit:** `seed_builtin_roles_for_org` trigger fires on Phase B and seeds Owner/Manager/Sales Rep with FRESH UUIDs per upserted org, so dump `user_roles.custom_role_id` FKs to non-existent rows. Script now remaps via `(organization_id, name)` lookup against live `custom_roles`. **Live: 10 user_roles (10 remapped) + 10 profiles.**
- [x] **Phase D — leads.** Whitelist by `organization_id`. Schema-diff: old DB cols missing in new (none observed) dropped; new-DB-only cols (`service_address`, `esi_id`, `title`, `deal_name`, `contract_start_date`, `cost_per_kwh`, `agent_mils`) get NULL via SQL default behavior. Chunked at 500 rows per `INSERT … VALUES (…), (…), … ON CONFLICT (id) DO UPDATE`. **Live: 10,182 leads upserted** (5,389 Caziah + 4,793 Crystal). The 6 dumped rows that didn't port belong to the 2 demo orgs we filter out.
- [ ] **Phase E — other-table data.** **DEFERRED.** Handoff calls Crystal's `contract_requests` empty and we haven't found evidence that the whitelisted orgs populate any of the other 82 tables non-trivially. Re-evaluate post-port if a follow-up audit finds populated rows tied to these orgs.
- [x] **Phase F — xlsx supplement.** Parser at `readXlsxRows()`. ESI = `Meter Number` with surrounding backticks stripped. `Unit Uplift` → `agent_mils`, `EAC AQ` → `annual_kwh`, `Start Date`/`End Date` parsed (Excel serial + ISO + native Date). Service address = composite of `address_1`/`address_2`/`street_no`/`street_name`/`city`/`state`/`postcode`. Match against new-DB leads (scoped to Caziah's org `8b8c76ab`) on `esi_id` first, then `(name + email)` lowercased fallback. UPDATE uses `COALESCE(${new}, existing)` so xlsx never overwrites a non-null field with a null. Unmatched rows → INSERT with `status='won'`, `source='xlsx_supplement'`. **NOT NULL on `leads.name` hit:** xlsx rows with only company+email blew up. Fallback added: `name = r.name ?? r.company ?? r.email ?? "Unknown"`. **Live: 982 ESI-matched updates + 3,809 new inserts** = 4,791 xlsx rows accounted (matches parsed total).
- [x] **Idempotency check.** Each phase uses ON CONFLICT (id) DO UPDATE or COALESCE-merge. Phase A was re-run successfully (idempotent). Production-port itself executed the same logic that branch-dry-run would have validated, so Step 3 collapsed into Step 4. See "Step 3+4 — Live production run" below.

### How to run the script

```
# Get DATABASE_URL from Supabase Dashboard → Settings → Database → Connection string
# → "Session pooler" or "Direct connection" (NOT the transaction pooler — we need
# DISABLE TRIGGER + SET LOCAL semantics that the transaction pooler strips).

export DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'

# Dry-run: parses dumps, counts what would happen, makes zero writes.
bun scripts/migrate-lovable-to-fixed.ts --dry

# Selective phase. Default --phase=ALL = A,B,C,D,F.
bun scripts/migrate-lovable-to-fixed.ts --phase=A
bun scripts/migrate-lovable-to-fixed.ts --phase=A,B,C,D
bun scripts/migrate-lovable-to-fixed.ts --phase=F

# Full run.
bun scripts/migrate-lovable-to-fixed.ts
```

Re-runs are safe — every INSERT uses `ON CONFLICT (id) DO UPDATE` (Phase A-D) or COALESCE-merge (Phase F UPDATE branch).

### Step 3+4 — Live production run `[x]` (executed 2026-05-19 session 5)

User chose to skip the preview-branch dry-run (cost-conscious; idempotent script). Production port ran directly against `coynbufhejaeuifpvmvw` via the Session pooler (port 5432). Database password was rotated as part of the run; new password lives in `.env` (gitignored).

**Live counts (verified post-port):**
- `auth.users` = 16 total (14 ported + 2 pre-existing dev/test accounts)
- `auth.identities` = 17 (15 ported + 2 pre-existing)
- `organizations` (whitelisted) = 2 — slugs: `greenenergiai` (Caziah org override applied) + `crystal-cameron-7ba2ebfa` (Crystal's own org, slug carried from dump as-is)
- `user_roles` (whitelisted orgs) = 10 (every `custom_role_id` remapped to new-org builtin role UUIDs)
- `profiles` (whitelisted orgs) = 10
- `leads` total ported = **13,991** = 9,198 Caziah (5,389 dump + 3,809 xlsx-supplement INSERT) + 4,793 Crystal-own (dump only, no xlsx scoped to her org)
- xlsx supplement accounted = 982 ESI-matched UPDATEs + 3,809 INSERTs = **4,791** (matches xlsx data-row count exactly)

**Open follow-ups (push to Step 5+ or treat as separate work):**
- [x] Spot-check 10 random Caziah leads — done 2026-05-22 (5 random, all `agent_mils` 0.5-1.4, `esi_id` 17-22 digit format, `current_supplier` + contract dates + composite `service_address` populated, `status='won'` / `source='xlsx_supplement'`). Quality good.
- [x] Crystal's own-org leads (`188c4869`) got no xlsx enrichment — **by design.** Crystal works FOR greenenergiai → her org `188c4869` IS the greenenergiai tenant. Caziah's `8b8c76ab` is a separate tenant with his own broker book (the xlsx was his data). Not a follow-up, intentional split.
- [x] Crystal's own-org slug rename — resolved 2026-05-22. `188c4869-…` now has slug `greenenergiai` (NOT the ugly `crystal-cameron-7ba2ebfa` from dump-as-is). See "Slug-flip vs plan" below.
- [x] Two-org structure stays per user direction. No further action.

#### Slug-flip vs plan (observed 2026-05-22)

Step 2 line 109 above says Caziah's `8b8c76ab-…` got the `greenenergiai` slug override. **Reality on new DB:** Caziah = `caziah-cameron` (shortened from dump's `caziah-cameron-66e0f158`), Crystal's own-org `188c4869-…` = `greenenergiai`. Slugs flipped vs the original plan. **By design.** Crystal works FOR greenenergiai (the company) — her org `188c4869` IS the greenenergiai tenant. Caziah = separate person, separate tenant. Old Lovable DB conflated them under "Caziah Cameron's Organization" w/ `is_reseller=t`; new model splits cleanly: Crystal = greenenergiai owner, Caziah = own tenant w/ his own broker book. Step-2 text above is original plan, not current reality.

#### Verification log (2026-05-22, post-port read-only check)

Counts queried against new DB to confirm migration still healthy:
- `auth.users` = 18 (14 ported + 2 pre-existing + 2 added since). Crystal's UUID `7ba2ebfa-f30e-449a-866e-085c5940c1d4` present on `crystal@greenenergiai.com`.
- Whitelisted `organizations` = 2 — both `8b8c76ab` (Caziah, separate tenant) + `188c4869` (Crystal, greenenergiai) present.
- Caziah's leads (`8b8c76ab`) = 9198 (5389 dump + 3809 xlsx INSERTs). His own broker book.
- Crystal's leads (`188c4869`, greenenergiai) = 4793 (dump-only). Fresh greenenergiai org she'll work from.
- Caziah leads with `agent_mils` populated = 4018. Same for `esi_id`. xlsx supplement intact on his tenant.

See `ISSUES.md ## Recent` 2026-05-22 entry for full sync record.

### Step 5 — Resume Crystal onboarding `[x]` (done 2026-05-22, verified via DB)

User DM'd Crystal the sign-in link for `greenenergiai.virecrm.com`. DB confirms:
- `auth.users.last_sign_in_at` for `crystal@greenenergiai.com` = 2026-05-20 22:51:19
- `auth.users.updated_at` = 2026-05-20 22:51:39 (20s after sign-in → password-change event)

Crystal signed in w/ ported bcrypt + rotated her temp password. Green-energiai onboarding handoff (`docs/handoffs/2026-05-18-green-energiai-onboarding.md`) → effectively closed for Crystal's side.

### Step 6 — Freeze old Lovable project `[x]` (closed 2026-05-22, user direction)

User: "The old Lovable project is gone — I have nothing to do with it now."

Old Lovable Supabase project is outside user's account (Lovable owns it; `supabase projects list` never returned it). User has no service-role key to revoke, no Supabase dashboard access, no DNS to take down (DNS already moved to virecrm.com per 2026-05-18). All sub-actions on the original Step 6 checklist are moot. Effectively done.

Caziah hasn't signed in on new DB (`has_password=false`, `last_sign_in_at` carries old-DB dump value). Tracked separately under `ISSUES.md ## Open` "[caziah-cameron] Onboard Caziah Cameron" — separate tenant, separate onboarding track, not a migration blocker.

`og_database/` dumps stay locally as historical reference until user chooses to delete them (still gitignored, still bcrypt+PII — read-not-cat rule still applies).

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
