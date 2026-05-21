// Helpers for the AutoFindLeadsDialog flow: server-error decoding, friendly
// reset-date label, and the preset option lists. Kept as plain functions /
// constants so they're trivially unit-testable and reusable from the hook.

export type AutoFindErrorCode =
  | "INTEGRATION_MISSING"
  | "QUOTA_EXCEEDED"
  | "PLATFORM_KEY_MISSING"
  | null;

export interface ParsedServerError {
  code: AutoFindErrorCode;
  clean: string;
  meta: { periodEnd?: string; used?: number; quota?: number } | null;
}

// Parse "[CODE] message::{json}" sentinel format from server fn errors.
export function parseServerError(msg: string): ParsedServerError {
  const m = msg.match(
    /^\[(INTEGRATION_MISSING|QUOTA_EXCEEDED|PLATFORM_KEY_MISSING)\]\s*([\s\S]*?)(?:::(\{[\s\S]*\}))?$/,
  );
  if (!m) return { code: null, clean: msg, meta: null };
  let meta: ParsedServerError["meta"] = null;
  if (m[3]) {
    try {
      meta = JSON.parse(m[3]);
    } catch {
      meta = null;
    }
  }
  return { code: m[1] as AutoFindErrorCode, clean: m[2], meta };
}

// Friendly date string for "credits reset on …".
export function formatResetDate(iso: string | undefined): string {
  if (!iso) return "the 1st of next month";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "the 1st of next month";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

// Default ISO string for "first of next month UTC" when the server didn't
// return a periodEnd on QUOTA_EXCEEDED.
export function nextMonthResetIso(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1)).toISOString();
}

export const INDUSTRY_PRESETS = [
  "SaaS",
  "E-commerce",
  "Real Estate",
  "Healthcare",
  "Agency",
  "Local Services",
] as const;

export const PERSONA_PRESETS = [
  "Founder/CEO",
  "Head of Sales",
  "Marketing Lead",
  "Operations",
] as const;
