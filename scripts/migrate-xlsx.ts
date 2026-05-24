#!/usr/bin/env bun
// Phase 2 — one-shot xlsx → Postgres migration runner.
// Idempotent (ON CONFLICT DO UPDATE on natural keys); per-row transactions in
// real mode, savepoints inside one outer rollback-only TX in --dry-run mode.
// All quarantine events stream to stderr + `tmp/quarantine-<ISO>.jsonl` so they
// survive any rollback. Final summary printed to stdout.
//
// Plan: /Users/darshpoddar/.claude/plans/do-phase-2-calm-hamming.md
// Decision sources: docs/decisions/06-domain-schema.md §1, docs/migration/field-map.md
//
// Usage:
//   bun scripts/migrate-xlsx.ts [--dry-run] [--tenant-subdomain=<sub>] [path/to/file.xlsx]
//
// Defaults: subdomain=greenenergiai, path="Copy of NGP MASTER LIST - Copy.xlsx".
// DATABASE_URL required in env (auto-loaded from .env by Bun).

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../workers/db/schema";
import { loadTenantBySubdomain } from "../workers/db/queries/tenants";
import { DEFAULT_XLSX_PATH, extractXlsx } from "./migrate-xlsx/extract";
import { transformRow } from "./migrate-xlsx/transform";
import {
  addRowCounts,
  emptyRowCounts,
  loadRow,
  resolveResoldLinks,
  type RowCounts,
  type TxLike,
} from "./migrate-xlsx/load";
import { AgentCache } from "./migrate-xlsx/dedup";
import { QuarantineSink, quarantinePath } from "./migrate-xlsx/quarantine";
import type { Summary, TransformedRow } from "./migrate-xlsx/types";

const DEFAULT_SUBDOMAIN = "greenenergiai";
const QUARANTINE_RATIO_THRESHOLD = 0.05; // >5% rows quarantined → exit 2

class RollbackSentinel extends Error {
  constructor() {
    super("dry-run rollback");
    this.name = "RollbackSentinel";
  }
}

interface CliOpts {
  dryRun: boolean;
  tenantSubdomain: string;
  xlsxPath: string;
}

function parseArgv(argv: readonly string[]): CliOpts {
  let dryRun = false;
  let tenantSubdomain = DEFAULT_SUBDOMAIN;
  let xlsxPath = DEFAULT_XLSX_PATH;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--tenant-subdomain=")) {
      tenantSubdomain = arg.slice("--tenant-subdomain=".length);
    } else if (arg.startsWith("--")) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    } else {
      xlsxPath = arg;
    }
  }
  return { dryRun, tenantSubdomain, xlsxPath };
}

/**
 * Every domain table has an RLS policy keyed on `auth.jwt() -> 'tenant_id'`.
 * This script runs outside any Worker request, so there's no JWT — RLS would
 * block every INSERT unless the connection role bypasses it (e.g., Postgres
 * superuser or Supabase `service_role`). Fail fast with a clear message if
 * row security would apply, rather than letting users discover it via 4,792
 * cryptic permission errors.
 */
async function assertRlsBypass(client: postgres.Sql): Promise<void> {
  const rows = await client<
    { current_user: string; row_security: string; bypassrls: boolean }[]
  >`
    SELECT current_user,
           current_setting('row_security') AS row_security,
           rolbypassrls AS bypassrls
    FROM pg_roles
    WHERE rolname = current_user
  `;
  const r = rows[0];
  if (!r) throw new Error("Could not read current Postgres role.");
  if (!r.bypassrls) {
    console.error(
      `Connection role "${r.current_user}" does not have BYPASSRLS. ` +
        `Every domain table has tenant-isolation RLS keyed on auth.jwt() ` +
        `which is NULL outside a Worker request, so inserts will be denied.\n` +
        `Use a superuser or Supabase service_role connection string for ` +
        `DATABASE_URL (typically the direct postgres:// URL on port 5432, ` +
        `not the pgbouncer/Hyperdrive pooled URL).`,
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const opts = parseArgv(process.argv.slice(2));
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL required (source .env or .env.development).");
    process.exit(1);
  }

  // max:1 — single sequential connection for this one-shot migration. Combined
  // with the per-row `await loadRow(...)` below, no two queries are ever in
  // flight, so postgres-js's pipeline path (default max_pipeline=100) never
  // engages. That matters because Supavisor's transaction-mode pool can
  // reassign the backend mid-pipeline and drop in-flight responses — see
  // porsager/postgres#970. Symptoms surface as a `ConnectionError` with
  // `code: 'CONNECTION_CLOSED'` or a `TypeError: Cannot read properties of
  // null (reading 'write')` thrown from connection.js (porsager/postgres
  // #1066, #1154). The per-row retry loop below catches both.
  const client = postgres(dbUrl, { prepare: false, max: 1, fetch_types: false });
  const db = drizzle(client, { schema });

  try {
    await assertRlsBypass(client);

    const tenant = await loadTenantBySubdomain(db, opts.tenantSubdomain);
    if (!tenant) {
      console.error(`Tenant not found for subdomain "${opts.tenantSubdomain}".`);
      process.exit(1);
    }

    const extract = await extractXlsx(opts.xlsxPath);
    const sink = new QuarantineSink(quarantinePath());
    const agentCache = new AgentCache();
    const saleIdToContractId = new Map<string, string>();
    const totals = emptyRowCounts();
    const transformedRows: TransformedRow[] = [];
    let processedRows = 0;
    let skippedRows = 0;
    let failedRows = 0;
    let resoldLinks = { linked: 0, missing: 0 };

    // Two-pass design: transform ALL rows up front so we can pre-warm the
    // agent cache (avoids per-row INSERTs that would leak across savepoint
    // rollbacks — see AgentCache docstring). Cost is buffering 4,792 rows in
    // memory, which is fine at this size.
    const buffered: TransformedRow[] = [];
    for await (const raw of extract.rows) {
      const { row, quarantine } = transformRow(raw, extract.headers);
      sink.writeMany(quarantine);
      if (!row) skippedRows++;
      else buffered.push(row);
    }

    const agentNames = new Set<string>();
    for (const r of buffered) {
      if (r.primaryAgentName) agentNames.add(r.primaryAgentName);
      if (r.secondaryAgentName) agentNames.add(r.secondaryAgentName);
    }

    const runPasses = async (executor: TxLike): Promise<void> => {
      // Pre-warm agents in their own tx (committed BEFORE row work starts).
      // In dry-run mode the executor is the outer rollback-only tx, so
      // prewarm inherits that rollback — agents created here disappear on
      // dry-run rollback, but the cache stays populated for the run.
      await agentCache.prewarm(executor, tenant.id, agentNames);

      for (const row of buffered) {
        let lastErr: unknown = null;
        // Retry per-row on transient connection drops from Supavisor (see the
        // header comment on the `postgres(...)` client above for root cause).
        // Match by `ConnectionError.code` (postgres-js's documented contract,
        // types/index.d.ts:437) plus the null-`socket.write` TypeError text
        // from porsager/postgres#1066. Pool replaces dropped backends, so a
        // fresh `await loadRow(...)` re-issues on a new connection.
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const result = await loadRow(
              executor,
              { tenantId: tenant.id, agentCache, saleIdToContractId },
              row,
            );
            addRowCounts(totals, result.counts);
            // Only mutate the cross-row map AFTER the per-row tx commits, so a
            // failed savepoint never leaves a stale UUID for pass 2.
            saleIdToContractId.set(row.externalSaleId, result.contractId);
            transformedRows.push(row);
            processedRows++;
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            const code = (err as { code?: string } | null)?.code;
            const msg = err instanceof Error ? err.message : String(err);
            const transient =
              code === "CONNECTION_CLOSED" ||
              code === "CONNECTION_DESTROYED" ||
              code === "CONNECT_TIMEOUT" ||
              /Cannot read properties of null \(reading 'write'\)/.test(msg) ||
              /null is not an object \(evaluating 'socket\.write'\)/.test(msg);
            if (!transient || attempt === 3) break;
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
        if (lastErr) {
          failedRows++;
          sink.write({
            rowNumber: row.rowNumber,
            column: "row",
            header: "load",
            rawValue: "",
            reason: `load failed (3 attempts): ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
            severity: "error",
          });
        }
      }
      resoldLinks = await resolveResoldLinks(
        executor,
        { tenantId: tenant.id, agentCache, saleIdToContractId },
        transformedRows,
      );
    };

    try {
      if (opts.dryRun) {
        try {
          await db.transaction(async (outerTx) => {
            await runPasses(outerTx);
            throw new RollbackSentinel();
          });
        } catch (err) {
          if (!(err instanceof RollbackSentinel)) throw err;
        }
      } else {
        await runPasses(db);
      }
    } finally {
      // Sink close MUST run even on pass failure — quarantine JSONL would
      // lose buffered writes if the stream isn't ended cleanly.
      await sink.close();
    }

    const quarantineRatio =
      extract.totalRows > 0 ? sink.errorCount / extract.totalRows : 0;
    const thresholdBreach = quarantineRatio > QUARANTINE_RATIO_THRESHOLD;

    const summary: Summary = {
      totalDataRows: extract.totalRows,
      processedRows,
      skippedRows,
      failedRows,
      dryRun: opts.dryRun,
      quarantineCount: sink.count,
      quarantinePath: sink.path,
      tables: {
        agents: {
          inserted: agentCache.insertedCount,
          updated: 0,
          reused: agentCache.reusedCount,
        },
        customers: { ...totals.customers, reused: 0 },
        service_addresses: { ...totals.service_addresses, updated: 0 },
        esis: { ...totals.esis, reused: 0 },
        contracts: { ...totals.contracts, reused: 0 },
        deals: { ...totals.deals, reused: 0 },
        commission_statements: { ...totals.commission_statements, updated: 0 },
        aggregator_payouts: { ...totals.aggregator_payouts, updated: 0 },
      },
      resoldLinks,
      status: thresholdBreach || failedRows > 0 ? "FAIL" : "PASS",
      failureReason: thresholdBreach
        ? `quarantine error ratio ${(quarantineRatio * 100).toFixed(2)}% > ${(QUARANTINE_RATIO_THRESHOLD * 100).toFixed(0)}%`
        : failedRows > 0
          ? `${failedRows} rows failed to load`
          : undefined,
    };

    printSummary(summary, tenant.subdomain, opts.xlsxPath);
    process.exit(summary.status === "PASS" ? 0 : 2);
  } finally {
    await client.end({ timeout: 5 });
  }
}

function printSummary(s: Summary, subdomain: string, xlsxPath: string): void {
  const dryNote = s.dryRun ? " (dry-run, transaction rolled back)" : "";
  console.log("");
  console.log("=".repeat(72));
  console.log(`Phase 2 migration — tenant "${subdomain}" — ${xlsxPath}`);
  console.log("=".repeat(72));
  console.log(`Total data rows:    ${s.totalDataRows}`);
  console.log(`Processed:          ${s.processedRows}`);
  console.log(`Skipped (missing identity): ${s.skippedRows}`);
  console.log(`Failed (load error):        ${s.failedRows}`);
  console.log("");
  console.log("Per-table counts:");
  for (const [name, c] of Object.entries(s.tables)) {
    const parts: string[] = [];
    if (c.inserted) parts.push(`${c.inserted} inserted`);
    if (c.updated) parts.push(`${c.updated} updated`);
    if (c.reused) parts.push(`${c.reused} reused`);
    console.log(`  ${name.padEnd(24)} ${parts.join(", ") || "0"}`);
  }
  console.log("");
  console.log(
    `Resold self-links:  ${s.resoldLinks.linked} linked, ${s.resoldLinks.missing} missing`,
  );
  console.log(
    `Quarantine:         ${s.quarantineCount} events → ${s.quarantinePath}`,
  );
  console.log("");
  console.log(`Status: ${s.status}${dryNote}`);
  if (s.failureReason) console.log(`Reason: ${s.failureReason}`);
  console.log("=".repeat(72));
}

await main();
