# Drizzle ORM (Postgres schema, migrations, queries)

- **Snapshot date:** 2026-05-22
- **Origin:** https://orm.drizzle.team
- **Refresh:** `bash scripts/sync-drizzle-docs.sh` (idempotent — re-pulls verbatim)

This mirror exists because Drizzle is our day-1 Postgres ORM (see project
`CLAUDE.md` + `docs/decisions/01-data-backend.md`). Read here first; do
**not** WebFetch upstream pages mid-build — version drift breaks
reproducibility.

## Files

| File | Size | Consult when |
|------|-----:|--------------|
| `llms.txt` | ~18 KB | Categorized index of every upstream doc URL. Scan first to locate the topic you need, then jump into `llms-full.txt`. |
| `llms-full.txt` | ~1.4 MB | Full corpus — single concatenated dump of all Drizzle docs. Grep this for any schema / migration / query / connection question. |
| `_urls.txt` | — | Provenance: source URLs the mirror was pulled from. |
| `_snapshot_date.txt` | — | Pin date for the snapshot. Bump only via re-running the sync script. |

## When to read this mirror (vs. `context7` MCP)

- **This mirror first** for: writing/editing Drizzle schema in `src/server/db/`,
  adding a column type, generating a migration, debugging a `drizzle-kit`
  command, picking a Postgres client driver, wiring relations.
- **`context7` only** when this mirror is silent on a brand-new feature
  released after the snapshot date — and then re-run the sync script
  afterwards so future reads stay local.

## Key concepts (anchors to grep inside `llms-full.txt`)

Schema declaration

- `pgTable` — declare a Postgres table. Day-1 building block for our 9 domain
  tables (Customer, ServiceAddress, ESI, Contract, Deal, Agent, LOA,
  CommissionStatement, AggregatorPayouts).
- `pgEnum` — Postgres enum types. Use for `Sale Status`, `Pipeline Status`,
  Lost/Drop reason codes.
- `pgSchema` — split tables across Postgres schemas (we keep one shared schema
  + `tenant_id` column; this is here for reference, not adoption).
- `text` / `varchar` / `numeric` / `timestamp` / `boolean` / `jsonb` — column
  type builders (see "PostgreSQL column types" section of `llms.txt`).
- `index` / `uniqueIndex` / `primaryKey` / `foreignKey` — index + constraint
  helpers. **All composite indexes must lead with `tenant_id`** per project
  CLAUDE.md.
- `GENERATED ALWAYS AS (...) STORED` — Drizzle exposes this via
  `generatedAlwaysAs(..., { mode: 'stored' })` on column builders. Used for
  `Gross TCV` / `Net TCV` computed columns. See "Generated Columns" section.

Migrations (drizzle-kit)

- `drizzle-kit generate` — emit SQL migration from schema diff. **Use this.**
- `drizzle-kit migrate` — apply pending migrations against the live DB.
- `drizzle-kit push` — direct schema push (dev only; never prod).
- `drizzle-kit pull` — introspect an existing DB into a schema file.
- `drizzle-kit studio` — local schema/data browser.
- `drizzle.config.ts` — config file shape. Section "Drizzle Kit configuration
  file" in `llms.txt`.

Connection / client

- `postgres-js` — our chosen client (see CLAUDE.md "Supabase Postgres = data
  backend"). Connect via the Cloudflare **Hyperdrive** binding's
  `connectionString`, *not* a raw `DATABASE_URL`.
- `drizzle({ client, schema })` — initialize the Drizzle instance inside the
  Worker.
- See "Drizzle <> Supabase" + "Drizzle <> PostgreSQL" sections for
  `postgres-js` examples.

Row-Level Security

- `pgPolicy` / `pgRole` — Drizzle-native RLS policy declaration. Pair with our
  `auth.jwt() -> 'tenant_id'` predicate. See "Row-Level Security (RLS)"
  section in `llms.txt`.
- Wrap `(SELECT auth.uid())` in policies to memoize (Supabase advice; carries
  over).

Queries / CRUD

- `db.select()` / `db.insert()` / `db.update()` / `db.delete()` — core builders.
- `db.query.<table>.findMany({...})` — relational queries (v2 / `rqb-v2`).
- `with` (CTEs), the `` sql`...` `` template tag for raw fragments, `union` /
  `intersect` / `except` for set operations.
- `INSERT … ON CONFLICT` via `.onConflictDoUpdate({...})` — required for our
  xlsx-migration upserts keyed by `External Sale Id` / `External Customer Id`.

Transactions

- `db.transaction(async (tx) => { ... })` — real Postgres transactions. Used
  for close-deal flow (project CLAUDE.md: "Real Postgres transactions for
  close-deal. No idempotency theater.").

Validators (auto-generated from schema)

- `drizzle-zod` — `createInsertSchema` / `createSelectSchema` for input
  validation in Worker route handlers.

## Snapshot maintenance

Re-run `scripts/sync-drizzle-docs.sh` and bump `_snapshot_date.txt` whenever
upstream ships a Drizzle ORM minor/major or a `drizzle-kit` migration-engine
change. Don't refresh casually — every bump is an audit point.
