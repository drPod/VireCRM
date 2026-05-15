import { supabase } from "@/integrations/supabase/client";

export type DeleteMode = "soft" | "hard";

export interface DeleteAttemptResult {
  id: string;
  data: unknown;
  error: { message: string; code?: string } | null;
  attempts: number;
}

/**
 * Errors we should NOT retry — these will never succeed on a second try.
 * Permission, not-found, and validation errors are deterministic.
 */
function isFatal(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  // Postgres / PostgREST permission, RLS, not-found, FK violation, check constraint.
  if (["42501", "PGRST116", "23503", "23514", "P0001"].includes(code)) return true;
  const msg = (err.message ?? "").toLowerCase();
  if (
    msg.includes("permission denied") ||
    msg.includes("not allowed") ||
    msg.includes("not found") ||
    msg.includes("does not exist") ||
    msg.includes("violates row-level security")
  ) {
    return true;
  }
  return false;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Delete a single lead with exponential backoff retry.
 * Defaults: up to 3 attempts (initial + 2 retries) at 300ms, 900ms.
 * Skips retry on deterministic failures (permissions, not-found, etc.).
 */
export async function deleteLeadWithRetry(
  id: string,
  mode: DeleteMode,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<DeleteAttemptResult> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 300;

  let lastError: { message: string; code?: string } | null = null;
  let lastData: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await supabase.rpc("delete_lead", {
      p_lead_id: id,
      p_mode: mode,
    });

    if (!error) {
      return { id, data, error: null, attempts: attempt };
    }
    lastError = { message: error.message, code: (error as { code?: string }).code };
    lastData = data;

    if (isFatal(lastError) || attempt === maxAttempts) break;

    // Exponential backoff with light jitter: 300ms, 900ms, 2700ms…
    const delay = baseDelayMs * Math.pow(3, attempt - 1) + Math.random() * 150;
    await sleep(delay);
  }

  return { id, data: lastData, error: lastError, attempts: maxAttempts };
}
