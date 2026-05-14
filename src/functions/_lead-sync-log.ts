// Shared helper for writing entries to lead_sync_log.
// Called from any server-side flow that fetches/imports leads so we have a
// single audit trail of what each run produced and which API errors occurred.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LeadSyncStatus = "success" | "partial" | "error" | "quota_exceeded";

export interface LeadSyncLogEntry {
  organizationId: string;
  userId?: string | null;
  /** Underlying provider used (apollo, hunter, snov, ...). */
  provider: string;
  /** Logical surface that triggered the run (auto_find, apollo_list_import, ...). */
  source: string;
  status: LeadSyncStatus;
  fetched?: number;
  revealed?: number;
  inserted?: number;
  updated?: number;
  duplicates?: number;
  noEmail?: number;
  durationMs?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort insert into lead_sync_log. Never throws — logging must not
 * break the calling flow. Errors are surfaced to the server console only.
 */
export async function recordLeadSync(entry: LeadSyncLogEntry): Promise<void> {
  try {
    // Cast: types regenerate async after migration; row shape matches the new table.
    const { error } = await (
      supabaseAdmin.from("lead_sync_log") as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }
    ).insert({
      organization_id: entry.organizationId,
      user_id: entry.userId ?? null,
      provider: entry.provider,
      source: entry.source,
      status: entry.status,
      fetched: entry.fetched ?? 0,
      revealed: entry.revealed ?? 0,
      inserted: entry.inserted ?? 0,
      updated: entry.updated ?? 0,
      duplicates: entry.duplicates ?? 0,
      no_email: entry.noEmail ?? 0,
      duration_ms: entry.durationMs ?? 0,
      error_code: entry.errorCode ?? null,
      error_message: entry.errorMessage ?? null,
      metadata: entry.metadata ?? null,
    });
    if (error) {
      console.error("[lead_sync_log] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[lead_sync_log] unexpected error:", err);
  }
}
