/**
 * Cron-triggered workflow runner.
 *
 * Vercel Cron sends GET with Authorization: Bearer $CRON_SECRET. External
 * schedulers may POST with x-cron-secret. Both verbs share one handler.
 *
 *   1. Re-queue paused runs whose paused_until has elapsed.
 *   2. Pick up queued runs whose next_attempt_at is due (or null).
 *   3. Call runOne() per run — that advances the graph as far as it can.
 *
 * Soft-fail per run: one bad workflow never blocks the rest of the batch.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runOne } from "@/lib/workflows/run";

const BATCH_SIZE = 25;

async function handleRunWorkflows(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!cronSecret || (headerSecret !== cronSecret && bearer !== cronSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const nowIso = new Date().toISOString();

  // 1. Re-queue paused runs whose timer has elapsed. Do this in a single
  //    UPDATE so two cron ticks racing each other can't both grab the
  //    same row (RETURNING + the WHERE filter make this safe).
  const { data: resumed, error: resumeErr } = await supabaseAdmin
    .from("workflow_runs")
    .update({ status: "queued", next_attempt_at: nowIso })
    .eq("status", "paused")
    .lte("paused_until", nowIso)
    .select("id");
  if (resumeErr) {
    return Response.json({ error: resumeErr.message }, { status: 500 });
  }

  // 2. Find work: queued runs whose next_attempt_at is due (NULL = ASAP).
  const { data: queued, error: fetchErr } = await supabaseAdmin
    .from("workflow_runs")
    .select("id")
    .eq("status", "queued")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (fetchErr) {
    return Response.json({ error: fetchErr.message }, { status: 500 });
  }

  // 3. Drain.
  const results: Array<{
    run_id: string;
    status: string;
    steps_executed?: number;
    error?: string;
  }> = [];
  for (const row of queued ?? []) {
    try {
      const out = await runOne(row.id);
      results.push(out);
    } catch (err) {
      results.push({
        run_id: row.id,
        status: "error",
        error: err instanceof Error ? err.message : "runner crashed",
      });
    }
  }

  const summary = {
    ok: true,
    resumed: resumed?.length ?? 0,
    processed: results.length,
    completed: results.filter((r) => r.status === "completed").length,
    paused: results.filter((r) => r.status === "paused").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    duration_ms: Date.now() - startedAt,
    ran_at: nowIso,
  };
  return Response.json(summary);
}

export const Route = createFileRoute("/api/public/hooks/run-workflows")({
  server: {
    handlers: {
      GET: async ({ request }) => handleRunWorkflows(request),
      POST: async ({ request }) => handleRunWorkflows(request),
    },
  },
});
