import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAudienceFilter, type AudienceFilter } from "@/lib/campaigns/audience-filter";

/**
 * Campaign scheduler — runs every 5 minutes via pg_cron.
 *
 * For each campaign where status='scheduled' AND scheduled_at<=now():
 *   1. Resolve the audience filter against `leads`.
 *   2. Skip suppressed addresses.
 *   3. Bulk-upsert enrollments into the linked sequence.
 *   4. Flip campaign + sequence to status='active'.
 *
 * Send execution then handled by the dispatch-sequences cron — this route
 * never enqueues emails directly.
 */

const BATCH_SIZE = 25;

export const Route = createFileRoute("/api/public/hooks/launch-scheduled-campaigns")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "Server not configured" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const nowIso = new Date().toISOString();

        const { data: campaigns, error: cErr } = await supabase
          .from("campaigns")
          .select(
            "id, organization_id, audience_filter, scheduled_at, outreach_sequences!outreach_sequences_campaign_id_fkey(id)",
          )
          .eq("status", "scheduled")
          .lte("scheduled_at", nowIso)
          .limit(BATCH_SIZE);

        if (cErr) {
          console.error("[launch-scheduled-campaigns] fetch error", cErr);
          return Response.json({ error: cErr.message }, { status: 500 });
        }

        if (!campaigns?.length) {
          return Response.json({ success: true, launched: 0 });
        }

        let launched = 0;
        let failed = 0;
        let totalEnrolled = 0;

        for (const campaign of campaigns) {
          try {
            const seqRows = (campaign as { outreach_sequences?: { id: string }[] | null })
              .outreach_sequences;
            const sequenceId = seqRows && seqRows.length ? seqRows[0].id : null;
            if (!sequenceId) {
              console.warn(
                "[launch-scheduled-campaigns] campaign has no linked sequence",
                campaign.id,
              );
              failed++;
              continue;
            }

            const filter = (campaign.audience_filter ?? {}) as AudienceFilter;
            const leads = await resolveAudienceFilter(supabase, campaign.organization_id, filter);
            const withEmail = leads.filter((l) => l.email);

            if (withEmail.length === 0) {
              await supabase
                .from("campaigns")
                .update({ status: "completed", completed_at: nowIso })
                .eq("id", campaign.id);
              continue;
            }

            const emails = withEmail.map((l) => l.email).filter((e): e is string => Boolean(e));
            const { data: supp } = await supabase
              .from("suppressed_emails")
              .select("email")
              .in("email", emails);
            const suppressedSet = new Set((supp ?? []).map((r) => r.email));
            const eligible = withEmail.filter((l) => l.email && !suppressedSet.has(l.email));

            const { data: firstStep } = await supabase
              .from("outreach_sequence_steps")
              .select("delay_days, delay_hours")
              .eq("sequence_id", sequenceId)
              .eq("organization_id", campaign.organization_id)
              .order("step_index", { ascending: true })
              .limit(1)
              .maybeSingle();

            const now = new Date();
            const step = firstStep as { delay_days: number; delay_hours: number } | null;
            const nextSend = step
              ? new Date(
                  now.getTime() +
                    step.delay_days * 24 * 60 * 60 * 1000 +
                    step.delay_hours * 60 * 60 * 1000,
                ).toISOString()
              : now.toISOString();

            const rows = eligible.map((l) => ({
              organization_id: campaign.organization_id,
              sequence_id: sequenceId,
              lead_id: l.id,
              current_step_index: 0,
              next_send_at: nextSend,
              status: "active",
            }));

            const { data: inserted, error: insErr } = await supabase
              .from("outreach_sequence_enrollments")
              .upsert(rows, { onConflict: "sequence_id,lead_id", ignoreDuplicates: true })
              .select("id");
            if (insErr) {
              console.error("[launch-scheduled-campaigns] enroll error", campaign.id, insErr);
              failed++;
              continue;
            }

            await supabase
              .from("campaigns")
              .update({ status: "active", launched_at: nowIso })
              .eq("id", campaign.id);
            await supabase
              .from("outreach_sequences")
              .update({ status: "active" })
              .eq("id", sequenceId);

            launched++;
            totalEnrolled += inserted?.length || 0;
          } catch (err) {
            console.error("[launch-scheduled-campaigns] campaign failed", campaign.id, err);
            failed++;
          }
        }

        return Response.json({
          success: true,
          launched,
          failed,
          enrolled: totalEnrolled,
        });
      },
    },
  },
});
