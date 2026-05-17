/**
 * Workflow execution engine — in-process runtime.
 *
 * Used from two surfaces, both Node TS, both calling runOne() directly:
 *   1. Cron worker  → src/routes/api/public/hooks/run-workflows.ts
 *      Drains queued runs + resumes paused runs whose wait elapsed.
 *   2. Server fn    → src/functions/workflows.functions.ts (Test Run button).
 *      Enqueues a single run, drives it through synchronously, returns the
 *      final status to the UI.
 *
 * Trigger surface (live):
 *   - lead_created   — fires from public.trg_workflow_lead_created
 *   - status_changed — fires from public.trg_workflow_lead_status_changed
 *   - message_received — fires from public.trg_workflow_message_received
 *   - manual         — UI "Test run" button
 *
 * Action surface (live):
 *   - action.send_email     → renders outreach-email template, enqueues via
 *                             dispatchOutreachEmail (Resend pipeline).
 *   - action.add_tag        → mutates leads.tags (idempotent).
 *   - action.update_field   → arbitrary lead column update with allowlist.
 *   - action.wait           → pauses the run with paused_until.
 *   - action.branch         → if/else on a lead field, picks edge handle.
 *   - action.webhook_post   → POSTs JSON to a configured URL.
 *
 * Stubbed (skipped with status='skipped' + reason logged):
 *   - action.score_lead, action.classify_reply, action.personalize_message,
 *     action.book_appointment — pending wire-up to the Anthropic SDK path
 *     (Phase 2 workflow AI). Will execute as no-ops until then.
 *
 * Retry policy:
 *   - Each entry into runOne() increments workflow_runs.attempts.
 *   - On transient failure (network / 5xx) the run is requeued with
 *     next_attempt_at = now + backoff(attempt). Capped at MAX_ATTEMPTS.
 *   - On permanent failure (workflow missing, lead deleted, etc.) we fail
 *     immediately and never retry.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { dispatchOutreachEmail } from "@/lib/email/dispatch-outreach";

export interface WorkflowNode {
  id: string;
  data: { kind: string; config: Record<string, unknown> };
}

export interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

interface WorkflowRow {
  id: string;
  organization_id: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface RunRow {
  id: string;
  organization_id: string;
  workflow_id: string;
  lead_id: string | null;
  status: string;
  resume_node_id: string | null;
  attempts: number;
  visited_node_ids: string[];
}

interface StepOutcome {
  status: "ok" | "error" | "skipped";
  message: string;
  output: Record<string, unknown>;
  duration_ms: number;
  pause_until?: string;
  next_handle?: string;
  /** Set when the failure should be retried (transient infrastructure issue). */
  retry?: boolean;
}

/** Action kinds that are intentional no-ops until the AI gateway is back. */
const AI_STUBS: ReadonlySet<string> = new Set([
  "action.score_lead",
  "action.classify_reply",
  "action.personalize_message",
  "action.book_appointment",
]);

/**
 * Columns the workflow runtime is allowed to write via action.update_field.
 * Lock this down so a misconfigured workflow can't trash auth or billing fields.
 */
const LEAD_WRITABLE_FIELDS: ReadonlySet<string> = new Set([
  "status",
  "score",
  "stage",
  "priority",
  "notes",
  "company",
  "phone",
  "email",
  "name",
  "next_followup_at",
]);

const MAX_NODES_PER_RUN = 50;
const MAX_ATTEMPTS = 3;

/** Backoff seconds per attempt. attempts=1 -> 60s, 2 -> 300s, 3 -> 900s. */
function backoffSeconds(attempt: number): number {
  return Math.min(60 * Math.pow(5, attempt - 1), 900);
}

/**
 * Pick up one run and advance it as far as possible in this tick.
 * Returns the final status reported back to the cron summary.
 */
export async function runOne(runId: string): Promise<{
  run_id: string;
  status: "completed" | "failed" | "paused" | "skipped";
  steps_executed: number;
  error?: string;
}> {
  // 1. Atomically claim the run — only if it's still queued/paused-and-due.
  // The cron worker pre-filters but we double-check here so two concurrent
  // workers can't both grab the same row.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("workflow_runs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .in("status", ["queued", "paused"])
    .select(
      "id, organization_id, workflow_id, lead_id, status, resume_node_id, attempts, visited_node_ids",
    )
    .maybeSingle();

  if (claimErr || !claimed) {
    return {
      run_id: runId,
      status: "skipped",
      steps_executed: 0,
      error: claimErr?.message ?? "run not claimable",
    };
  }

  const run = claimed as RunRow;
  const attempts = run.attempts + 1;
  await supabaseAdmin
    .from("workflow_runs")
    .update({ attempts, next_attempt_at: null })
    .eq("id", runId);

  // 2. Hydrate the workflow definition.
  const { data: wfRow } = await supabaseAdmin
    .from("workflows")
    .select("id, organization_id, nodes, edges")
    .eq("id", run.workflow_id)
    .eq("organization_id", run.organization_id)
    .maybeSingle();

  if (!wfRow) {
    return await failRun(runId, "workflow not found", attempts);
  }
  const wf: WorkflowRow = {
    id: wfRow.id,
    organization_id: wfRow.organization_id,
    nodes: (wfRow.nodes ?? []) as unknown as WorkflowNode[],
    edges: (wfRow.edges ?? []) as unknown as WorkflowEdge[],
  };

  // 3. Decide where to start: explicit resume_node_id (after a wait) or the
  //    trigger node (fresh start).
  let currentId: string | null;
  const visited = new Set<string>(run.visited_node_ids ?? []);
  if (run.resume_node_id) {
    currentId = run.resume_node_id;
  } else {
    const trigger = wf.nodes.find((n) => n.data?.kind?.startsWith("trigger."));
    if (!trigger) return await failRun(runId, "no trigger node", attempts);
    currentId = trigger.id;
  }

  // 4. Walk the graph until we complete, pause, or fail.
  let executed = 0;
  let pauseUntil: string | null = null;
  let pauseAtNodeId: string | null = null;

  while (currentId && executed < MAX_NODES_PER_RUN) {
    if (visited.has(currentId)) {
      // Cycle — refuse to spin.
      await logStep(runId, currentId, "cycle", "error", "cycle detected", {});
      return await failRun(runId, "cycle detected", attempts);
    }
    visited.add(currentId);

    const node: WorkflowNode | undefined = wf.nodes.find((n) => n.id === currentId);
    if (!node) break;

    let nextHandle: string | null = null;

    if (node.data.kind.startsWith("trigger.")) {
      await logStep(runId, node.id, node.data.kind, "ok", "trigger fired", {});
    } else {
      const outcome = await executeNode(node, run.lead_id, run.organization_id);
      await logStep(
        runId,
        node.id,
        node.data.kind,
        outcome.status,
        outcome.message,
        outcome.output,
        outcome.duration_ms,
      );

      if (outcome.status === "error") {
        if (outcome.retry && attempts < MAX_ATTEMPTS) {
          return await rescheduleRun(runId, attempts, outcome.message, visited, currentId);
        }
        return await failRun(runId, outcome.message, attempts);
      }
      if (outcome.pause_until) {
        // Advance to the node *after* the wait so the resume picks up there.
        const nextEdge = wf.edges.find((e) => e.source === currentId);
        pauseAtNodeId = nextEdge?.target ?? null;
        pauseUntil = outcome.pause_until;
        break;
      }
      nextHandle = outcome.next_handle ?? null;
    }
    executed += 1;

    // Find next edge — strict handle match for branches, any edge otherwise.
    const nextEdge = nextHandle
      ? wf.edges.find((e) => e.source === currentId && e.sourceHandle === nextHandle)
      : wf.edges.find((e) => e.source === currentId);
    currentId = nextEdge?.target ?? null;
  }

  if (pauseUntil) {
    await supabaseAdmin
      .from("workflow_runs")
      .update({
        status: "paused",
        paused_until: pauseUntil,
        resume_node_id: pauseAtNodeId,
        visited_node_ids: Array.from(visited),
        finished_at: null,
      })
      .eq("id", runId);
    return { run_id: runId, status: "paused", steps_executed: executed };
  }

  await supabaseAdmin
    .from("workflow_runs")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      visited_node_ids: Array.from(visited),
      resume_node_id: null,
    })
    .eq("id", runId);
  await supabaseAdmin
    .from("workflows")
    .update({
      last_run_at: new Date().toISOString(),
      completed_count: await incrementCount(wf.id, "completed_count"),
    })
    .eq("id", wf.id);
  return { run_id: runId, status: "completed", steps_executed: executed };
}

/**
 * Fetch + bump a counter atomically-ish. Best-effort: race conditions just
 * mean the counter is slightly off, never wrong by orders of magnitude.
 */
async function incrementCount(workflowId: string, field: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("workflows")
    .select(field)
    .eq("id", workflowId)
    .maybeSingle();
  const current = (data as unknown as Record<string, number> | null)?.[field] ?? 0;
  return current + 1;
}

async function failRun(
  runId: string,
  message: string,
  attempts: number,
): Promise<{
  run_id: string;
  status: "failed";
  steps_executed: number;
  error: string;
}> {
  await supabaseAdmin
    .from("workflow_runs")
    .update({
      status: "failed",
      error: message,
      finished_at: new Date().toISOString(),
      attempts,
    })
    .eq("id", runId);
  return { run_id: runId, status: "failed", steps_executed: 0, error: message };
}

async function rescheduleRun(
  runId: string,
  attempts: number,
  message: string,
  visited: Set<string>,
  currentNodeId: string,
): Promise<{
  run_id: string;
  status: "skipped";
  steps_executed: number;
  error: string;
}> {
  const backoffMs = backoffSeconds(attempts) * 1000;
  await supabaseAdmin
    .from("workflow_runs")
    .update({
      status: "queued",
      next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
      error: message,
      attempts,
      resume_node_id: currentNodeId,
      visited_node_ids: Array.from(visited).filter((id) => id !== currentNodeId),
      started_at: null,
    })
    .eq("id", runId);
  return { run_id: runId, status: "skipped", steps_executed: 0, error: message };
}

async function logStep(
  runId: string,
  nodeId: string,
  nodeKind: string,
  status: "ok" | "error" | "skipped",
  message: string,
  output: Record<string, unknown>,
  duration_ms = 0,
): Promise<void> {
  // `output` is jsonb in the schema. Cast through unknown because our caller
  // types it as `Record<string, unknown>` for ergonomics — values are plain
  // objects/strings/numbers, never functions or class instances.
  await supabaseAdmin.from("workflow_run_steps").insert({
    run_id: runId,
    node_id: nodeId,
    node_kind: nodeKind,
    status,
    message,
    output: output as unknown as Json,
    duration_ms,
  });
}

function done(
  start: number,
  status: "ok" | "error" | "skipped",
  message: string,
  output: Record<string, unknown>,
): StepOutcome {
  return { status, message, output, duration_ms: Date.now() - start };
}

async function executeNode(
  node: WorkflowNode,
  leadId: string | null,
  organizationId: string,
): Promise<StepOutcome> {
  const start = Date.now();
  const kind = node.data.kind;
  const config = node.data.config ?? {};

  // ---- AI agent stubs (pending wire-up to Anthropic SDK path) ----
  if (AI_STUBS.has(kind)) {
    return done(start, "skipped", `${kind} stubbed (AI gateway offline)`, {});
  }

  try {
    if (kind === "action.send_email") {
      if (!leadId) return done(start, "skipped", "no lead", {});
      const subject = String(config.subject ?? "").trim();
      const body = String(config.body ?? "").trim();
      if (!subject && !body) return done(start, "skipped", "empty email", {});

      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, organization_id, email, name")
        .eq("id", leadId)
        .maybeSingle();
      if (!lead) return done(start, "error", "lead not found", {});
      if (!lead.email) return done(start, "skipped", "lead has no email", {});

      // Pull org branding for the template.
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id, brand_name, name, logo_url, primary_color, font_family, email_signature")
        .eq("id", lead.organization_id)
        .maybeSingle();

      const fillCtx = {
        name: lead.name,
        email: lead.email,
        businessName: org?.brand_name || org?.name || "",
      };
      const filledSubject = fillTokens(subject, fillCtx);
      const filledBody = fillTokens(body, fillCtx);

      const result = await dispatchOutreachEmail({
        templateName: "outreach-email",
        recipientEmail: lead.email,
        templateData: {
          subject: filledSubject,
          body: filledBody,
          brandName: org?.brand_name || org?.name || "Majix",
          logoUrl: org?.logo_url || undefined,
          accentColor: org?.primary_color || undefined,
          fontFamily: org?.font_family || undefined,
          signature: org?.email_signature || undefined,
        },
        idempotencyKey: `wf-${node.id}-${leadId}`,
        fromName: org?.brand_name || org?.name,
      });

      if (!result.success) {
        if (result.reason === "suppressed") {
          return done(start, "skipped", "recipient suppressed", { email: lead.email });
        }
        // render_failed = permanent (bad config); enqueue_failed = transient.
        const isTransient = result.reason === "enqueue_failed";
        const outcome = done(start, "error", result.error ?? result.reason, {
          reason: result.reason,
        });
        return { ...outcome, retry: isTransient };
      }

      // Also record an outbound message row so the timeline shows the send.
      await supabaseAdmin.from("messages").insert({
        organization_id: lead.organization_id,
        lead_id: leadId,
        type: "email",
        direction: "outbound",
        subject: filledSubject,
        content: filledBody,
        status: "sent",
      });

      return done(start, "ok", "email sent", {
        subject: filledSubject,
        message_id: result.messageId,
      });
    }

    if (kind === "action.add_tag") {
      if (!leadId) return done(start, "skipped", "no lead", {});
      const tag = String(config.tag ?? "").trim();
      if (!tag) return done(start, "skipped", "empty tag", {});
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("tags")
        .eq("id", leadId)
        .maybeSingle();
      const next = Array.from(new Set([...(lead?.tags ?? []), tag]));
      await supabaseAdmin.from("leads").update({ tags: next }).eq("id", leadId);
      return done(start, "ok", `tagged "${tag}"`, { tags: next });
    }

    if (kind === "action.update_field") {
      if (!leadId) return done(start, "skipped", "no lead", {});
      const field = String(config.field ?? "").trim();
      const value = config.value;
      if (!field) return done(start, "skipped", "no field", {});
      if (!LEAD_WRITABLE_FIELDS.has(field)) {
        return done(start, "error", `field "${field}" not writable`, {});
      }
      // The field allowlist gives us safety; the type cast widens past the
      // generated Supabase Insert type, which can't statically prove the
      // string maps to a known column.
      await supabaseAdmin
        .from("leads")
        .update({ [field]: value } as never)
        .eq("id", leadId);
      return done(start, "ok", `${field} updated`, {
        field,
        value: value as Json,
      });
    }

    if (kind === "action.wait") {
      const amount = Number(config.amount ?? 0);
      const unit = String(config.unit ?? "minutes");
      const unitMs: Record<string, number> = {
        minutes: 60_000,
        hours: 3_600_000,
        days: 86_400_000,
        weeks: 604_800_000,
      };
      const ms = amount * (unitMs[unit] ?? unitMs.minutes);
      const until = new Date(Date.now() + ms).toISOString();
      return { ...done(start, "ok", `waiting until ${until}`, { until }), pause_until: until };
    }

    if (kind === "action.branch") {
      if (!leadId) return done(start, "skipped", "no lead", {});
      const field = String(config.field ?? "score");
      const op = String(config.operator ?? ">");
      const value = config.value;
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select(field)
        .eq("id", leadId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const left: any = (lead as Record<string, unknown> | null)?.[field];
      const right =
        value === null || value === undefined || isNaN(Number(value)) ? value : Number(value);
      let pass = false;
      switch (op) {
        case ">":
          pass = Number(left) > Number(right);
          break;
        case "<":
          pass = Number(left) < Number(right);
          break;
        case ">=":
          pass = Number(left) >= Number(right);
          break;
        case "<=":
          pass = Number(left) <= Number(right);
          break;
        case "==":
        case "=":
          pass = left == right;
          break;
        case "!=":
          pass = left != right;
          break;
        default:
          pass = false;
      }
      return {
        ...done(start, "ok", `${field} ${op} ${right} -> ${pass}`, { pass }),
        next_handle: pass ? "true" : "false",
      };
    }

    if (kind === "action.webhook_post") {
      const url = String(config.url ?? "").trim();
      if (!url) return done(start, "skipped", "no url", {});
      if (!/^https?:\/\//i.test(url)) {
        return done(start, "error", "url must be http(s)", {});
      }
      const body = config.body ?? {};
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId,
            organization_id: organizationId,
            data: body,
            sent_at: new Date().toISOString(),
          }),
          // Tight timeout so a hung webhook can't block the cron tick.
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          // 5xx → transient retry; 4xx → permanent.
          const isTransient = res.status >= 500;
          const outcome = done(start, "error", `webhook ${res.status}`, { status: res.status });
          return { ...outcome, retry: isTransient };
        }
        return done(start, "ok", `webhook ${res.status}`, { status: res.status });
      } catch (err) {
        // Network error / timeout → transient.
        const outcome = done(
          start,
          "error",
          err instanceof Error ? err.message : "webhook failed",
          {},
        );
        return { ...outcome, retry: true };
      }
    }

    return done(start, "skipped", `unsupported kind ${kind}`, {});
  } catch (e) {
    return done(start, "error", e instanceof Error ? e.message : "unknown error", {});
  }
}

/**
 * Minimal token replacer matching the outreach send pattern.
 * Replaces {{name}}, {{email}}, {{businessName}} with provided values.
 */
function fillTokens(text: string, ctx: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = ctx[key];
    return v === null || v === undefined ? "" : String(v);
  });
}
