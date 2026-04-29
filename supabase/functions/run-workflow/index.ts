/**
 * Workflow runner.
 *
 * Two invocation modes:
 *   1) Manual / "Test run": POST { workflow_id, lead_id } with caller JWT.
 *   2) Queue dispatch: POST { dispatch: true } with caller JWT — drains up to
 *      DISPATCH_BATCH queued runs for the caller's organization.
 *
 * For each run:
 *   - Find the trigger node, walk edges, execute each node sequentially.
 *   - For action.* nodes, perform the side-effect (or invoke the matching AI
 *     agent function for action.score_lead / classify_reply / etc.).
 *   - Record one row in workflow_run_steps per executed node.
 *   - Mark the run completed/failed/paused.
 *
 * Wait nodes pause the run (status='paused', paused_until=<timestamp>). A
 * future cron sweep can reactivate paused runs whose timer has elapsed.
 */
// @ts-expect-error - Deno runtime import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

interface WorkflowNode {
  id: string;
  data: { kind: string; config: Record<string, unknown> };
}
interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

const AGENT_FUNCTIONS: Record<string, string> = {
  "action.score_lead": "score-lead",
  "action.classify_reply": "classify-reply",
  "action.personalize_message": "personalize-message",
  "action.book_appointment": "book-appointment",
};

const DISPATCH_BATCH = 5;
const MAX_NODES_PER_RUN = 50;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization" }, 401);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userClient: any = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return json({ error: "No organization" }, 400);
  const orgId = profile.organization_id;

  const body = await req.json().catch(() => ({}));

  // Mode 1: dispatch — drain queued runs
  if (body.dispatch) {
    const { data: queued } = await admin
      .from("workflow_runs")
      .select("id, workflow_id, lead_id")
      .eq("organization_id", orgId)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(DISPATCH_BATCH);

    const results: Array<{ run_id: string; status: string; error?: string }> = [];
    for (const run of queued ?? []) {
      const out = await executeRun(admin, authHeader, orgId, run.id, run.workflow_id, run.lead_id);
      results.push({ run_id: run.id, ...out });
    }
    return json({ dispatched: results.length, results });
  }

  // Mode 2: explicit one-shot run (Test Run)
  const workflowId = body.workflow_id;
  const leadId = body.lead_id ?? null;
  if (!workflowId) return json({ error: "workflow_id required" }, 400);

  const { data: run, error: insErr } = await admin
    .from("workflow_runs")
    .insert({
      organization_id: orgId,
      workflow_id: workflowId,
      lead_id: leadId,
      triggered_by: "manual",
      status: "queued",
    })
    .select("id")
    .single();
  if (insErr || !run) return json({ error: insErr?.message ?? "insert failed" }, 500);

  const out = await executeRun(admin, authHeader, orgId, run.id, workflowId, leadId);
  return json({ run_id: run.id, ...out });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeRun(admin: any, authHeader: string, orgId: string, runId: string, workflowId: string, leadId: string | null) {
  const startedAt = new Date().toISOString();
  await admin.from("workflow_runs").update({ status: "running", started_at: startedAt }).eq("id", runId);

  const { data: wf, error: wfErr } = await admin
    .from("workflows")
    .select("id, nodes, edges, organization_id")
    .eq("id", workflowId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (wfErr || !wf) {
    await admin.from("workflow_runs").update({ status: "failed", error: "workflow not found", finished_at: new Date().toISOString() }).eq("id", runId);
    return { status: "failed", error: "workflow not found" };
  }

  const nodes = (wf.nodes ?? []) as WorkflowNode[];
  const edges = (wf.edges ?? []) as WorkflowEdge[];

  const trigger = nodes.find((n) => n.data?.kind?.startsWith("trigger."));
  if (!trigger) {
    await admin.from("workflow_runs").update({ status: "failed", error: "no trigger node", finished_at: new Date().toISOString() }).eq("id", runId);
    return { status: "failed", error: "no trigger node" };
  }

  // Walk graph from trigger, recording each step.
  let currentId: string | null = trigger.id;
  let executed = 0;
  let pausedUntil: string | null = null;
  const visited = new Set<string>();

  while (currentId && executed < MAX_NODES_PER_RUN) {
    if (visited.has(currentId)) break; // cycle guard
    visited.add(currentId);

    const node: WorkflowNode | undefined = nodes.find((n) => n.id === currentId);
    if (!node) break;

    let nextHandle: string | null = null;

    if (node.data.kind.startsWith("trigger.")) {
      // Trigger itself is a no-op; record and continue.
      await logStep(admin, runId, node, "ok", "trigger fired", {});
    } else {
      const step = await executeNode(admin, authHeader, node, leadId);
      await logStep(admin, runId, node, step.status, step.message, step.output, step.duration_ms);
      if (step.status === "error") {
        await admin.from("workflow_runs").update({ status: "failed", error: step.message, finished_at: new Date().toISOString() }).eq("id", runId);
        return { status: "failed", error: step.message };
      }
      if (step.pause_until) {
        pausedUntil = step.pause_until;
        break;
      }
      nextHandle = step.next_handle ?? null;
    }
    executed++;

    // Find next node by edge. If the step yielded a branch handle, prefer it.
    // For branch nodes (which set next_handle), strictly require a matching
    // sourceHandle edge — never fall back to "any" edge, since that risks
    // taking the wrong branch (e.g. picking "false" when the branch said "true").
    // For non-branch nodes (no next_handle), pick any outgoing edge.
    const nextEdge = nextHandle
      ? edges.find((e) => e.source === currentId && e.sourceHandle === nextHandle)
      : edges.find((e) => e.source === currentId);
    currentId = nextEdge?.target ?? null;
  }

  if (pausedUntil) {
    await admin.from("workflow_runs").update({ status: "paused", paused_until: pausedUntil, finished_at: new Date().toISOString() }).eq("id", runId);
    return { status: "paused", paused_until: pausedUntil };
  }

  await admin.from("workflow_runs").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", runId);
  return { status: "completed", steps_executed: executed };
}

interface StepResult {
  status: "ok" | "error" | "skipped";
  message: string;
  output: Record<string, unknown>;
  duration_ms: number;
  pause_until?: string;
  next_handle?: string;
}

async function executeNode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  authHeader: string,
  node: WorkflowNode,
  leadId: string | null,
): Promise<StepResult> {
  const start = Date.now();
  const kind = node.data.kind;
  const config = node.data.config ?? {};

  try {
    // ---- AI agent nodes: forward to the agent edge function ----
    if (AGENT_FUNCTIONS[kind]) {
      if (!leadId) return done(start, "skipped", "AI agent requires a lead", {});
      const fnName = AGENT_FUNCTIONS[kind];
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        },
        body: JSON.stringify({ lead_id: leadId, ...config }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return done(start, "error", out.error ?? `Agent ${fnName} failed (${res.status})`, out);
      return done(start, "ok", `${fnName} done`, out);
    }

    if (kind === "action.add_tag") {
      if (!leadId) return done(start, "skipped", "no lead", {});
      const tag = String(config.tag ?? "").trim();
      if (!tag) return done(start, "skipped", "empty tag", {});
      const { data: lead } = await admin.from("leads").select("tags").eq("id", leadId).maybeSingle();
      const next = Array.from(new Set([...(lead?.tags ?? []), tag]));
      await admin.from("leads").update({ tags: next }).eq("id", leadId);
      return done(start, "ok", `tagged "${tag}"`, { tags: next });
    }

    if (kind === "action.send_email") {
      // We don't ship transactional email here; queue it as a draft outbound message.
      if (!leadId) return done(start, "skipped", "no lead", {});
      const subject = String(config.subject ?? "");
      const body = String(config.body ?? "");
      if (!subject && !body) return done(start, "skipped", "empty email", {});
      const { data: lead } = await admin.from("leads").select("organization_id").eq("id", leadId).maybeSingle();
      if (!lead?.organization_id) return done(start, "error", "lead has no org", {});
      await admin.from("messages").insert({
        organization_id: lead.organization_id,
        lead_id: leadId,
        type: "email",
        direction: "outbound",
        subject,
        content: body,
        status: "draft",
      });
      return done(start, "ok", "email drafted", { subject });
    }

    if (kind === "action.wait") {
      const amount = Number(config.amount ?? 0);
      const unit = String(config.unit ?? "minutes");
      const ms = unit === "days" ? amount * 86400000 : unit === "hours" ? amount * 3600000 : amount * 60000;
      const until = new Date(Date.now() + ms).toISOString();
      return { ...done(start, "ok", `waiting until ${until}`, { until }), pause_until: until };
    }

    if (kind === "action.branch") {
      if (!leadId) return done(start, "skipped", "no lead", {});
      const field = String(config.field ?? "score");
      const op = String(config.operator ?? ">");
      const value = config.value;
      const { data: lead } = await admin.from("leads").select(field).eq("id", leadId).maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const left: any = lead?.[field];
      const right = isNaN(Number(value)) ? value : Number(value);
      let pass = false;
      switch (op) {
        case ">": pass = Number(left) > Number(right); break;
        case "<": pass = Number(left) < Number(right); break;
        case ">=": pass = Number(left) >= Number(right); break;
        case "<=": pass = Number(left) <= Number(right); break;
        case "==": case "=": pass = left == right; break;
        case "!=": pass = left != right; break;
        default: pass = false;
      }
      return { ...done(start, "ok", `${field} ${op} ${right} → ${pass}`, { pass }), next_handle: pass ? "true" : "false" };
    }

    return done(start, "skipped", `unsupported kind ${kind}`, {});
  } catch (e) {
    return done(start, "error", e instanceof Error ? e.message : "unknown error", {});
  }
}

function done(start: number, status: "ok" | "error" | "skipped", message: string, output: Record<string, unknown>): StepResult {
  return { status, message, output, duration_ms: Date.now() - start };
}

async function logStep(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  runId: string,
  node: WorkflowNode,
  status: "ok" | "error" | "skipped",
  message: string,
  output: Record<string, unknown>,
  duration_ms = 0,
) {
  await admin.from("workflow_run_steps").insert({
    run_id: runId,
    node_id: node.id,
    node_kind: node.data.kind,
    status,
    message,
    output,
    duration_ms,
  });
}
