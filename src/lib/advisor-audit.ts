import type { SupabaseClient } from "@supabase/supabase-js";

interface LogPlanArgs {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string | null;
  command: string;
  summary: string | null;
  plan: unknown;
  durationMs: number;
  errorMessage?: string | null;
}

interface LogExecutionArgs {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string | null;
  command: string;
  summary: string | null;
  plan: unknown;
  results: Array<{ status: string; handler?: string }>;
  durationMs: number;
  errorMessage?: string | null;
}

/**
 * Write an audit row using the service role client. Failures are swallowed
 * so logging never breaks the user-facing flow.
 */
export async function logAdvisorPlan(args: LogPlanArgs): Promise<void> {
  try {
    await args.supabase.from("advisor_audit_log").insert({
      organization_id: args.organizationId,
      user_id: args.userId,
      command: args.command,
      phase: "plan",
      summary: args.summary,
      plan: args.plan as Record<string, unknown>,
      duration_ms: args.durationMs,
      error_message: args.errorMessage ?? null,
    });
  } catch (err) {
    console.error("[advisor-audit] failed to log plan", err);
  }
}

export async function logAdvisorExecution(args: LogExecutionArgs): Promise<void> {
  try {
    const ok = args.results.filter((r) => r.status === "ok").length;
    const err = args.results.filter((r) => r.status === "error").length;
    const skip = args.results.filter((r) => r.status === "skipped").length;
    const handlers = args.results.reduce<Record<string, number>>((acc, r) => {
      const h = r.handler ?? "in_app";
      acc[h] = (acc[h] ?? 0) + 1;
      return acc;
    }, {});

    await args.supabase.from("advisor_audit_log").insert({
      organization_id: args.organizationId,
      user_id: args.userId,
      command: args.command,
      phase: "execute",
      summary: args.summary,
      plan: args.plan as Record<string, unknown>,
      results: args.results as unknown as Record<string, unknown>,
      handlers,
      ok_count: ok,
      error_count: err,
      skipped_count: skip,
      duration_ms: args.durationMs,
      error_message: args.errorMessage ?? null,
    });
  } catch (err) {
    console.error("[advisor-audit] failed to log execution", err);
  }
}
