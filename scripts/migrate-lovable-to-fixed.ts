#!/usr/bin/env bun
/**
 * Lovable old-DB → fixed-DB new-DB migration.
 *
 * Source = SQL dumps in og_database/ (the old Lovable Supabase project is
 * inside Lovable's account; no live API access). xlsx supplement fills the
 * energy-broker fields the old importer dropped.
 *
 * Strategy = enrich, not replace. UUIDs preserved. Bcrypt hashes ported via
 * direct insert into auth.users. handle_new_user trigger short-circuits via
 * the `app.skip_auto_provision` GUC (added in migration
 * 20260519120000_handle_new_user_skip_guc.sql) so we don't disable the trigger
 * directly — postgres doesn't own auth.users (supabase_auth_admin does) and
 * Supabase blocks granting that role to postgres.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... bun scripts/migrate-lovable-to-fixed.ts [--phase=ALL|A|B|C|D|F] [--dry]
 *
 * DATABASE_URL must be a session-pooler or direct connection to the new
 * Supabase project (NOT the transaction pooler — we need SET LOCAL). Get
 * it from Dashboard → Settings → Database → Connection string → "Session
 * pooler" or "Direct connection".
 *
 * Full plan: docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md
 */

import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const AUTH_DUMP = resolve(ROOT, "og_database/genesis_auth_data.sql");
const FULL_DUMP = resolve(ROOT, "og_database/genesis_database_full.sql");
const XLSX_PATH = resolve(ROOT, "Copy of NGP MASTER LIST - Copy.xlsx");

// ----- CLI flags -----
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry");
const phaseArg = [...args].find((a) => a.startsWith("--phase="))?.split("=")[1] ?? "ALL";
const RUN_PHASES = new Set(
  phaseArg === "ALL" ? ["A", "B", "C", "D", "F"] : phaseArg.split(",").map((s) => s.trim().toUpperCase()),
);

// ----- Env -----
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERR: DATABASE_URL missing. Use Supabase session pooler or direct connection string.");
  console.error("Dashboard → Settings → Database → Connection string");
  process.exit(1);
}

const sql = new SQL(DATABASE_URL);

// ----- Whitelist / filters -----
const SKIP_EMAIL_PATTERNS: RegExp[] = [
  /^qa\d*[-_@]/i,
  /^audit\+/i,
  /^e2etest/i,
  /^testcrm@/i,
];

// Whitelist orgs to port (verified real). Crystal owns 188c4869; Caziah owns 8b8c76ab.
// Other orgs in the dump are demo data (4e0a3989 ethansereti's, 6e87b377 testcrm).
// Per handoff: rename Caziah's slug to 'greenenergiai' to match wrangler subdomain.
const ALLOWED_ORG_IDS = new Set([
  "8b8c76ab-08de-4fd1-a703-b06138078181", // Caziah's org (5389 leads)
  "188c4869-8bc4-438e-b746-c8f28e2932d2", // Crystal's own org (4793 leads)
]);
const ORG_SLUG_OVERRIDES: Record<string, string> = {
  "8b8c76ab-08de-4fd1-a703-b06138078181": "greenenergiai",
};

const isSkippedEmail = (email: string | null) => !!email && SKIP_EMAIL_PATTERNS.some((r) => r.test(email));

// ----- Postgres COPY text format decode -----
// Reference: https://www.postgresql.org/docs/current/sql-copy.html#id-1.9.3.55.9.2
function decodeCopyField(s: string): string | null {
  if (s === "\\N") return null;
  return s.replace(/\\(.)/g, (_, c) => {
    switch (c) {
      case "n": return "\n";
      case "r": return "\r";
      case "t": return "\t";
      case "b": return "\b";
      case "f": return "\f";
      case "v": return "\v";
      case "0": return "\0";
      case "\\": return "\\";
      default: return c;
    }
  });
}

interface CopyBlock { columns: string[]; rows: (string | null)[][] }

function parseCopyBlocks(sqlText: string): Map<string, CopyBlock> {
  const out = new Map<string, CopyBlock>();
  const lines = sqlText.split("\n");
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^COPY "public"\."([^"]+)" \(([^)]+)\) FROM stdin;$/);
    if (!m) { i++; continue; }
    const table = m[1];
    const columns = m[2].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const rows: (string | null)[][] = [];
    i++;
    while (i < lines.length && lines[i] !== "\\.") {
      rows.push(lines[i].split("\t").map(decodeCopyField));
      i++;
    }
    out.set(table, { columns, rows });
    i++;
  }
  return out;
}

// ----- Postgres VALUES tuple parser (for auth INSERT lines) -----
// Each line: INSERT INTO auth.X (cols) VALUES (vals) ON CONFLICT (id) DO NOTHING;
function parsePgValues(tuple: string): (string | null)[] {
  const out: (string | null)[] = [];
  let i = 0;
  const n = tuple.length;
  while (i < n) {
    while (i < n && (tuple[i] === " " || tuple[i] === ",")) i++;
    if (i >= n) break;
    if (tuple[i] === "'") {
      let s = "";
      i++;
      while (i < n) {
        if (tuple[i] === "'" && tuple[i + 1] === "'") { s += "'"; i += 2; }
        else if (tuple[i] === "'") { i++; break; }
        else { s += tuple[i]; i++; }
      }
      out.push(s);
    } else {
      let tok = "";
      while (i < n && tuple[i] !== "," && tuple[i] !== ")") { tok += tuple[i]; i++; }
      tok = tok.trim();
      if (tok === "NULL") out.push(null);
      else out.push(tok);
    }
  }
  return out;
}

interface AuthInserts {
  users: Record<string, string | null>[];
  identities: Record<string, string | null>[];
}

function parseAuthInserts(sqlText: string): AuthInserts {
  const users: Record<string, string | null>[] = [];
  const identities: Record<string, string | null>[] = [];
  for (const line of sqlText.split("\n")) {
    let m = line.match(/^INSERT INTO auth\.users \(([^)]+)\) VALUES \((.*)\)(?: ON CONFLICT[^;]*)?;$/);
    if (m) {
      const cols = m[1].split(",").map((c) => c.trim());
      const vals = parsePgValues(m[2]);
      const row: Record<string, string | null> = {};
      for (let k = 0; k < cols.length; k++) row[cols[k]] = vals[k] ?? null;
      users.push(row);
      continue;
    }
    m = line.match(/^INSERT INTO auth\.identities \(([^)]+)\) VALUES \((.*)\)(?: ON CONFLICT[^;]*)?;$/);
    if (m) {
      const cols = m[1].split(",").map((c) => c.trim());
      const vals = parsePgValues(m[2]);
      const row: Record<string, string | null> = {};
      for (let k = 0; k < cols.length; k++) row[cols[k]] = vals[k] ?? null;
      identities.push(row);
    }
  }
  return { users, identities };
}

// ----- New-DB column introspection -----
const liveColsCache = new Map<string, Set<string>>();
async function getLiveCols(table: string, schema = "public"): Promise<Set<string>> {
  const key = `${schema}.${table}`;
  if (liveColsCache.has(key)) return liveColsCache.get(key)!;
  const rows = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = ${schema} AND table_name = ${table}
  `;
  const set = new Set<string>(rows.map((r: { column_name: string }) => r.column_name));
  liveColsCache.set(key, set);
  return set;
}

// Turn a COPY row (array) into an object keyed by column, restricted to columns
// that exist live in the new DB. Drops unknown old-DB columns.
async function rowsToObjects(
  table: string,
  block: CopyBlock,
  schema = "public",
): Promise<Record<string, string | null>[]> {
  const live = await getLiveCols(table, schema);
  const keptIdx: number[] = [];
  for (let i = 0; i < block.columns.length; i++) {
    if (live.has(block.columns[i])) keptIdx.push(i);
  }
  const droppedCols = block.columns.filter((c) => !live.has(c));
  if (droppedCols.length) {
    console.log(`  [info] ${table}: dropping cols not in new schema: ${droppedCols.join(", ")}`);
  }
  return block.rows.map((r) => {
    const o: Record<string, string | null> = {};
    for (const i of keptIdx) o[block.columns[i]] = r[i];
    return o;
  });
}

// Chunk an array into N-sized slices.
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Build "EXCLUDED.col" SET clause for ON CONFLICT DO UPDATE.
function buildExcludedSet(columns: string[], skip: string[] = ["id"]): string {
  return columns
    .filter((c) => !skip.includes(c))
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(", ");
}

// Quote a Postgres identifier.
const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

// ----- Phase runners -----

async function phaseA_authUsers(dump: AuthInserts) {
  console.log("\n=== Phase A — auth.users + auth.identities ===");

  const eligibleUsers = dump.users.filter((u) => !isSkippedEmail(u.email));
  const skippedUsers = dump.users.length - eligibleUsers.length;
  console.log(`  ${dump.users.length} total / ${eligibleUsers.length} eligible / ${skippedUsers} skipped (qa/audit/e2e/testcrm)`);

  if (dryRun) {
    console.log(`  [dry-run] would insert ${eligibleUsers.length} auth.users + filtered auth.identities`);
    return;
  }

  await sql.begin(async (tx) => {
    // Short-circuit handle_new_user via GUC so it doesn't auto-provision a
    // duplicate org per ported user. We port orgs/profiles/roles separately.
    // Postgres doesn't own auth.users (supabase_auth_admin does), so we can't
    // DISABLE TRIGGER. The GUC check was added in migration
    // 20260519120000_handle_new_user_skip_guc.sql.
    await tx.unsafe(`SET LOCAL app.skip_auto_provision = 'on'`);
    // Pose as service_role so RLS + service-role-gated triggers allow writes.
    await tx.unsafe(`SET LOCAL request.jwt.claim.role = 'service_role'`);

    try {
      const liveAuthUsers = await tx`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='auth' AND table_name='users'
      `;
      const liveAuthUserCols = new Set<string>(
        liveAuthUsers.map((r: { column_name: string }) => r.column_name),
      );

      // Project dumped users to live columns.
      const projected = eligibleUsers.map((u) => {
        const o: Record<string, string | null> = {};
        for (const k of Object.keys(u)) if (liveAuthUserCols.has(k)) o[k] = u[k];
        return o;
      });

      // Per-row INSERT … ON CONFLICT (id) DO UPDATE. Doing per-row instead of
      // bulk because Supabase auth.users has many constraint-bearing columns.
      let inserted = 0;
      for (const u of projected) {
        const cols = Object.keys(u);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const colList = cols.map(q).join(", ");
        const updateClause = buildExcludedSet(cols);
        await tx.unsafe(
          `INSERT INTO auth.users (${colList}) VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
          cols.map((c) => u[c]),
        );
        inserted++;
      }
      console.log(`  auth.users: ${inserted} inserted/upserted`);

      // auth.identities — filter to users we kept
      const keptUserIds = new Set(eligibleUsers.map((u) => u.id));
      const eligibleIdent = dump.identities.filter((iden) => iden.user_id && keptUserIds.has(iden.user_id));

      const liveAuthIdent = await tx`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='auth' AND table_name='identities'
      `;
      const liveAuthIdentCols = new Set<string>(
        liveAuthIdent.map((r: { column_name: string }) => r.column_name),
      );

      let identInserted = 0;
      for (const iden of eligibleIdent) {
        const projected: Record<string, string | null> = {};
        for (const k of Object.keys(iden)) if (liveAuthIdentCols.has(k)) projected[k] = iden[k];
        const cols = Object.keys(projected);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const colList = cols.map(q).join(", ");
        const updateClause = buildExcludedSet(cols);
        await tx.unsafe(
          `INSERT INTO auth.identities (${colList}) VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
          cols.map((c) => projected[c]),
        );
        identInserted++;
      }
      console.log(`  auth.identities: ${identInserted} inserted/upserted`);
    } finally {
      // SET LOCAL auto-reverts at transaction commit/rollback — nothing to undo.
    }
  });
}

async function phaseB_organizations(blocks: Map<string, CopyBlock>) {
  console.log("\n=== Phase B — organizations ===");
  const block = blocks.get("organizations");
  if (!block) { console.log("  no organizations COPY block found"); return; }

  const idIdx = block.columns.indexOf("id");
  const dumpedEligible = block.rows.filter((r) => idIdx >= 0 && ALLOWED_ORG_IDS.has(r[idIdx] ?? ""));
  console.log(`  ${block.rows.length} dumped / ${dumpedEligible.length} whitelisted`);

  if (dryRun) {
    console.log(`  [dry-run] would upsert ${dumpedEligible.length} organizations`);
    return;
  }

  const objs = await rowsToObjects("organizations", { columns: block.columns, rows: dumpedEligible });

  // Apply slug override + flip is_reseller false (legacy flag, dormant).
  for (const o of objs) {
    if (o.id && ORG_SLUG_OVERRIDES[o.id]) o.slug = ORG_SLUG_OVERRIDES[o.id];
    if ("is_reseller" in o) o.is_reseller = "f";
  }

  await upsertRows("organizations", objs);
  console.log(`  organizations: ${objs.length} upserted`);
}

async function phaseC_userRolesAndProfiles(blocks: Map<string, CopyBlock>) {
  console.log("\n=== Phase C — user_roles + profiles ===");

  // We need the eligible user IDs (excluded qa/audit/e2e/testcrm) — re-derive
  // from the auth dump.
  const authText = readFileSync(AUTH_DUMP, "utf8");
  const { users: authUsers } = parseAuthInserts(authText);
  const eligibleUserIds = new Set(
    authUsers.filter((u) => !isSkippedEmail(u.email)).map((u) => u.id),
  );

  // Build old_custom_role_id → role_name map from the dump. The new DB's
  // seed_builtin_roles_for_org trigger created fresh custom_roles per
  // Phase-B-upserted org with new UUIDs, so user_roles.custom_role_id from
  // the dump won't FK match. Remap by (organization_id, name).
  const oldRoleToName = new Map<string, string>(); // old_role_id → name
  const crBlock = blocks.get("custom_roles");
  if (crBlock) {
    const idIdx = crBlock.columns.indexOf("id");
    const nameIdx = crBlock.columns.indexOf("name");
    for (const r of crBlock.rows) {
      if (idIdx >= 0 && nameIdx >= 0 && r[idIdx] && r[nameIdx]) {
        oldRoleToName.set(r[idIdx]!, r[nameIdx]!);
      }
    }
  }

  // (org_id, name) → new custom_role_id, fetched live (only if not dry).
  const newRoleByKey = new Map<string, string>();
  if (!dryRun) {
    const orgIds = [...ALLOWED_ORG_IDS];
    const live = await sql<Array<{ id: string; organization_id: string; name: string }>>`
      SELECT id, organization_id, name FROM public.custom_roles
      WHERE organization_id IN ${sql(orgIds)}
    `;
    for (const r of live) newRoleByKey.set(`${r.organization_id}|${r.name}`, r.id);
  }

  for (const table of ["user_roles", "profiles"] as const) {
    const block = blocks.get(table);
    if (!block) { console.log(`  ${table}: no COPY block`); continue; }

    const orgIdx = block.columns.indexOf("organization_id");
    const userIdx = block.columns.indexOf("user_id");
    const dumpedEligible = block.rows.filter((r) =>
      orgIdx >= 0 && userIdx >= 0 &&
      ALLOWED_ORG_IDS.has(r[orgIdx] ?? "") &&
      eligibleUserIds.has(r[userIdx] ?? ""),
    );
    console.log(`  ${table}: ${block.rows.length} dumped / ${dumpedEligible.length} eligible`);

    if (dryRun) {
      console.log(`  [dry-run] would upsert ${dumpedEligible.length} ${table}`);
      continue;
    }

    const objs = await rowsToObjects(table, { columns: block.columns, rows: dumpedEligible });

    if (table === "user_roles") {
      let remapped = 0;
      let cleared = 0;
      for (const o of objs) {
        const oldRoleId = o["custom_role_id"];
        if (!oldRoleId) continue;
        const orgId = o["organization_id"];
        const name = oldRoleToName.get(oldRoleId);
        const newId = name && orgId ? newRoleByKey.get(`${orgId}|${name}`) : undefined;
        if (newId) {
          o["custom_role_id"] = newId;
          remapped++;
        } else {
          o["custom_role_id"] = null;
          cleared++;
        }
      }
      console.log(`  user_roles: custom_role_id remapped=${remapped} cleared=${cleared}`);
    }

    await upsertRows(table, objs);
    console.log(`  ${table}: ${objs.length} upserted`);
  }
}

async function phaseD_leads(blocks: Map<string, CopyBlock>) {
  console.log("\n=== Phase D — leads ===");
  const block = blocks.get("leads");
  if (!block) { console.log("  no leads COPY block"); return; }

  const orgIdx = block.columns.indexOf("organization_id");
  const dumpedEligible = block.rows.filter((r) => orgIdx >= 0 && ALLOWED_ORG_IDS.has(r[orgIdx] ?? ""));
  console.log(`  ${block.rows.length} dumped / ${dumpedEligible.length} on whitelisted orgs`);

  if (dryRun) {
    console.log(`  [dry-run] would upsert ${dumpedEligible.length} leads`);
    return;
  }

  const objs = await rowsToObjects("leads", { columns: block.columns, rows: dumpedEligible });
  await upsertRows("leads", objs, 500);
  console.log(`  leads: ${objs.length} upserted`);
}

// ----- xlsx supplement -----

interface XlsxRow {
  esi: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  service_address: string | null;
  current_supplier: string | null;
  annual_kwh: number | null;
  agent_mils: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
}

function parseXlsxDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  // xlsx may give Date objects, numbers (Excel serial), or strings
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial: days since 1899-12-30
    const ms = (v - 25569) * 86400 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    // ISO already?
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, $]/g, ""));
  return isNaN(n) ? null : n;
}

function stripBackticks(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.replace(/^`+|`+$/g, "") || null;
}

function compositeAddress(r: Record<string, unknown>): string | null {
  const parts = [
    r["address_1"],
    r["address_2"],
    r["street_no"],
    r["street_name"],
    r["city"],
    r["state"],
    r["postcode"],
  ]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function readXlsxRows(): XlsxRow[] {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  return json.map((r) => ({
    esi: stripBackticks(r["Meter Number"]),
    name: r["contact_person"] ? String(r["contact_person"]).trim() : null,
    email: r["customer_email"] ? String(r["customer_email"]).trim().toLowerCase() : null,
    phone: r["telephone"] ? String(r["telephone"]).trim() : null,
    company: r["Customer Name"] ? String(r["Customer Name"]).trim() : null,
    title: r["designation"] ? String(r["designation"]).trim() : null,
    service_address: compositeAddress(r),
    current_supplier: r["Supplier"] ? String(r["Supplier"]).trim() : null,
    annual_kwh: num(r["EAC AQ"]),
    agent_mils: num(r["Unit Uplift"]),
    contract_start_date: parseXlsxDate(r["Start Date"]),
    contract_end_date: parseXlsxDate(r["End Date"]),
  }));
}

async function phaseF_xlsxSupplement() {
  console.log("\n=== Phase F — xlsx supplement ===");
  const rows = readXlsxRows();
  console.log(`  xlsx: ${rows.length} rows parsed`);

  // Restrict matches/inserts to Caziah's org (the green-energiai tenant).
  const targetOrg = "8b8c76ab-08de-4fd1-a703-b06138078181";

  if (dryRun) {
    console.log(`  [dry-run] would match xlsx vs leads on ${targetOrg} and update/insert`);
    return;
  }

  // Load existing leads from target org once.
  const existing = await sql`
    SELECT id, organization_id, name, email, phone, esi_id
    FROM public.leads
    WHERE organization_id = ${targetOrg} AND deleted_at IS NULL
  `;
  type Lead = { id: string; organization_id: string; name: string | null; email: string | null; phone: string | null; esi_id: string | null };
  const byEsi = new Map<string, Lead>();
  const byNameEmail = new Map<string, Lead>();
  for (const l of existing as Lead[]) {
    if (l.esi_id) byEsi.set(l.esi_id, l);
    if (l.name && l.email) byNameEmail.set(`${l.name.toLowerCase().trim()}|${l.email.toLowerCase().trim()}`, l);
  }

  let updated = 0;
  let inserted = 0;
  await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL request.jwt.claim.role = 'service_role'`);
    for (const r of rows) {
      let matched: Lead | undefined;
      if (r.esi && byEsi.has(r.esi)) matched = byEsi.get(r.esi);
      else if (r.name && r.email) matched = byNameEmail.get(`${r.name.toLowerCase()}|${r.email.toLowerCase()}`);

      if (matched) {
        await tx`
          UPDATE public.leads SET
            esi_id = COALESCE(${r.esi}, esi_id),
            title = COALESCE(${r.title}, title),
            service_address = COALESCE(${r.service_address}, service_address),
            current_supplier = COALESCE(${r.current_supplier}, current_supplier),
            annual_kwh = COALESCE(${r.annual_kwh}, annual_kwh),
            agent_mils = COALESCE(${r.agent_mils}, agent_mils),
            contract_start_date = COALESCE(${r.contract_start_date}::date, contract_start_date),
            contract_end_date = COALESCE(${r.contract_end_date}::date, contract_end_date),
            updated_at = now()
          WHERE id = ${matched.id}
        `;
        updated++;
      } else if (r.name || r.company || r.email) {
        // leads.name is NOT NULL. xlsx rows often have only company+email
        // (commercial accounts). Fall back so the row is portable.
        const leadName = r.name ?? r.company ?? r.email ?? "Unknown";
        await tx`
          INSERT INTO public.leads
            (organization_id, name, email, phone, company, status, source,
             esi_id, title, service_address, current_supplier,
             annual_kwh, agent_mils, contract_start_date, contract_end_date)
          VALUES
            (${targetOrg}, ${leadName}, ${r.email}, ${r.phone}, ${r.company}, 'won', 'xlsx_supplement',
             ${r.esi}, ${r.title}, ${r.service_address}, ${r.current_supplier},
             ${r.annual_kwh}, ${r.agent_mils}, ${r.contract_start_date}::date, ${r.contract_end_date}::date)
        `;
        inserted++;
      }
    }
  });
  console.log(`  xlsx: ${updated} leads updated, ${inserted} new leads inserted`);
}

// ----- Generic upsert helper -----

async function upsertRows(table: string, rows: Record<string, string | null>[], chunkSize = 500) {
  if (rows.length === 0) return;
  // Union of all keys across rows (rows may have missing optional columns).
  const colSet = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) colSet.add(k);
  const cols = [...colSet];
  const colList = cols.map(q).join(", ");
  const updateClause = buildExcludedSet(cols);

  for (const slice of chunk(rows, chunkSize)) {
    const valuesSql: string[] = [];
    const params: (string | null)[] = [];
    let pi = 0;
    for (const r of slice) {
      const placeholders: string[] = [];
      for (const c of cols) {
        params.push(r[c] ?? null);
        pi++;
        placeholders.push(`$${pi}`);
      }
      valuesSql.push(`(${placeholders.join(", ")})`);
    }
    const stmt = `INSERT INTO public.${q(table)} (${colList}) VALUES ${valuesSql.join(", ")}
                  ON CONFLICT (id) DO UPDATE SET ${updateClause}`;
    // Wrap each chunk in a transaction so SET LOCAL request.jwt.claim.role
    // = 'service_role' applies — bypasses RLS + service-role-gated triggers
    // (e.g. enforce_custom_domain_entitlement, leads_enforce_industry_template
    // etc.) that check auth.role() before allowing the write.
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL request.jwt.claim.role = 'service_role'`);
      await tx.unsafe(stmt, params);
    });
  }
}

// ----- Main -----

async function main() {
  console.log(`Lovable→fixed migration | phases=${[...RUN_PHASES].join(",")} | dry=${dryRun}`);
  console.log(`Target DB: ${DATABASE_URL!.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@")}`);

  const authText = readFileSync(AUTH_DUMP, "utf8");
  const fullText = readFileSync(FULL_DUMP, "utf8");

  const authInserts = parseAuthInserts(authText);
  console.log(`Parsed auth dump: ${authInserts.users.length} users, ${authInserts.identities.length} identities`);

  const blocks = parseCopyBlocks(fullText);
  console.log(`Parsed full dump: ${blocks.size} COPY blocks`);

  if (RUN_PHASES.has("A")) await phaseA_authUsers(authInserts);
  if (RUN_PHASES.has("B")) await phaseB_organizations(blocks);
  if (RUN_PHASES.has("C")) await phaseC_userRolesAndProfiles(blocks);
  if (RUN_PHASES.has("D")) await phaseD_leads(blocks);
  if (RUN_PHASES.has("F")) await phaseF_xlsxSupplement();

  console.log("\nDone.");
  await sql.end();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await sql.end(); } catch {}
  process.exit(1);
});
