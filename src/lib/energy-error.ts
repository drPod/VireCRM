/**
 * Translates Supabase/PostgREST errors raised by Energy module CRUD into
 * structured failure objects the UI can render verbatim. The goal is to
 * make RLS denials and column/schema mismatches debuggable in one glance,
 * without forcing devs to dig through network panel JSON.
 */
import type { PostgrestError } from "@supabase/supabase-js";

export interface EnergyFailure {
  /** Postgres SQLSTATE or PostgREST sentinel (e.g. "42501", "PGRST204"). */
  code: string;
  /** Raw server message. */
  message: string;
  /** Server-provided detail string, when present. */
  details?: string;
  /** Server-provided hint, when present. */
  hint?: string;
  /** Table the operation targeted. */
  table: string;
  /** Operation we attempted. */
  operation: "insert" | "update" | "delete" | "select";
  /** Human-readable explanation of the most likely root cause. */
  policyHint: string;
}

/** Map common SQLSTATE/PGRST codes to a plain-English explanation. */
function explain(code: string, msg: string): string {
  switch (code) {
    case "42501":
      return "RLS denial — the row violates a Row-Level Security policy. Check that organization_id matches the caller's org and that the user's role allows INSERT/UPDATE on this table.";
    case "23502":
      return `NOT NULL violation — a required column was omitted (${msg}). Add the missing field to createFields or to defaults.`;
    case "23503":
      return "Foreign key violation — a referenced id does not exist (e.g. lead_id, supplier_id). Make sure the referenced row exists and belongs to the same org.";
    case "23505":
      return "Unique constraint violation — a row with the same key already exists.";
    case "23514":
      return "Check constraint violation — a value failed a CHECK (often a status enum). Verify the value is in the allowed list.";
    case "42703":
      return "Column does not exist — the route's createFields or columns reference a column the table does not have. Sync the route config with the schema.";
    case "42P01":
      return "Table does not exist — the EnergyTableConfig.table value does not match a real table.";
    case "PGRST204":
      return "PostgREST schema cache miss — a column in the payload is unknown. Usually a stale schema cache or a misnamed createFields key.";
    case "PGRST116":
      return "Zero rows returned where exactly one was expected — likely an RLS filter hiding the row, or a wrong id.";
    case "P0001":
      return `Database raised a custom exception: ${msg}. Often emitted by a SECURITY DEFINER guard (e.g. has_role org-isolation check) when required context is missing.`;
    default:
      return "Unrecognized error — inspect the raw message and details below.";
  }
}

export function fromPostgrest(
  err: PostgrestError,
  table: string,
  operation: EnergyFailure["operation"],
): EnergyFailure {
  const code = err.code ?? "UNKNOWN";
  return {
    code,
    message: err.message,
    details: err.details ?? undefined,
    hint: err.hint ?? undefined,
    table,
    operation,
    policyHint: explain(code, err.message),
  };
}
