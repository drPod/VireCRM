import { supabase } from "@/integrations/supabase/client";

export type DomainRow = {
  id: string;
  hostname: string;
  is_primary: boolean;
  verification_token: string;
  verified_at: string | null;
  created_at: string;
};

export type OwnerRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

// Per-row auto-verification state surfaced in the UI.
export type AutoState = {
  status: "idle" | "checking" | "waiting" | "verified" | "failed";
  attempt: number;
  maxAttempts: number;
  nextCheckAt: number | null; // epoch ms
  lastError: string | null;
};

export type DomainEventType =
  | "added"
  | "removed"
  | "set_primary"
  | "verify_attempt"
  | "verify_success"
  | "verify_failed"
  | "dns_lookup_failed"
  | "auto_verify_started"
  | "auto_verify_stopped";

export type DomainEventStatus = "info" | "success" | "warning" | "error";

export const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

// Retry schedule (ms) — fast at first while DNS may already be cached, then back off.
export const RETRY_DELAYS_MS = [
  3_000, // ~immediate
  7_000, // 10s
  15_000, // 25s
  30_000, // 55s
  60_000, // ~2m
  120_000, // ~4m
  180_000, // ~7m
  300_000, // ~12m
  600_000, // ~22m
];

// Fire-and-forget audit logger. Failures here must never block the user action,
// so we just log them to the console for ops.
export async function logEvent(args: {
  orgId: string;
  domainId: string | null;
  hostname: string;
  eventType: DomainEventType;
  status: DomainEventStatus;
  message?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Cast params: generated RPC types treat NULLABLE params as `string` (required)
    // because the SQL signature doesn't carry NULL info into the typegen.
    await supabase.rpc("log_custom_domain_event", {
      p_org_id: args.orgId,
      p_domain_id: args.domainId,
      p_hostname: args.hostname,
      p_event_type: args.eventType,
      p_status: args.status,
      p_message: args.message ?? null,
      p_details: (args.details ?? {}) as never,
    } as never);
  } catch (err) {
    console.warn("[custom-domain audit] failed to log event", err);
  }
}
