/**
 * Workflow server functions.
 *
 * - testRunWorkflowFn: manual "Test run" entry point from the builder UI.
 *   Auth'd by JWT, scopes to the caller's org, enqueues a workflow_runs row
 *   with triggered_by='manual', then drives it through runOne synchronously
 *   so the UI gets the final status (completed / paused / failed) inline.
 *
 * Replaces the old Deno edge function `run-workflow` which kept a parallel
 * copy of the engine and short-circuited action.send_email to a `messages`
 * draft instead of actually sending. The cron worker + this function share
 * one implementation in src/lib/workflows/run.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/auth/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runOne } from "@/lib/workflows/run";
import { z } from "zod";

const inputSchema = z.object({
  workflow_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
});

export interface TestRunResponse {
  run_id: string;
  status: "completed" | "failed" | "paused" | "skipped";
  steps_executed: number;
  error?: string;
}

export const testRunWorkflowFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<TestRunResponse> => {
    const admin = supabaseAdmin;
    const userId = context.userId;

    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (profErr || !profile?.organization_id) {
      throw new Error("Organization not found for current user");
    }
    const orgId = profile.organization_id;

    // Verify the workflow belongs to the caller's org before we create a run
    // row — prevents cross-tenant test runs even if the UI sends a bad id.
    const { data: wf, error: wfErr } = await admin
      .from("workflows")
      .select("id")
      .eq("id", data.workflow_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (wfErr || !wf) {
      throw new Error("Workflow not found in this organization");
    }

    if (data.lead_id) {
      const { data: lead } = await admin
        .from("leads")
        .select("id")
        .eq("id", data.lead_id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!lead) {
        throw new Error("Lead not found in this organization");
      }
    }

    const { data: run, error: insErr } = await admin
      .from("workflow_runs")
      .insert({
        organization_id: orgId,
        workflow_id: data.workflow_id,
        lead_id: data.lead_id ?? null,
        triggered_by: "manual",
        status: "queued",
      })
      .select("id")
      .single();
    if (insErr || !run) {
      throw new Error(insErr?.message ?? "Failed to enqueue test run");
    }

    return await runOne(run.id);
  });
