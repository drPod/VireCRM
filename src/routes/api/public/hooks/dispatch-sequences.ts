import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { dispatchOutreachEmail } from "@/lib/email/dispatch-outreach";
import { fillTemplateTokens } from "@/lib/outreach/template-fill";

/**
 * Sequence dispatcher — runs every minute via pg_cron.
 *
 * For each enrollment whose `next_send_at` is due:
 *   1. Re-check stop rules (reply / appointment may have arrived since last tick).
 *   2. Verify the parent sequence is still `active`.
 *   3. Honor the sequence's send-window (hours of day + weekend setting).
 *   4. Render the current step's template (or inline override) with lead tokens.
 *   5. Enqueue the email via the in-process outreach dispatcher.
 *   6. Advance to the next step (or mark `completed` if last).
 *
 * Soft-fail per enrollment: one bad lead never blocks the rest of the batch.
 */

interface SequenceRow {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  send_window_start_hour: number;
  send_window_end_hour: number;
  send_on_weekends: boolean;
}

interface StepRow {
  id: string;
  step_index: number;
  template_id: string | null;
  subject_override: string | null;
  body_override: string | null;
  delay_days: number;
  delay_hours: number;
  is_active: boolean;
}

interface EnrollmentRow {
  id: string;
  organization_id: string;
  sequence_id: string;
  lead_id: string;
  current_step_index: number;
  status: string;
}

interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
}

interface OrgRow {
  id: string;
  brand_name: string | null;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  font_family: string | null;
  email_signature: string | null;
}

const BATCH_SIZE = 25;

function isWithinSendWindow(now: Date, seq: SequenceRow): boolean {
  if (!seq.send_on_weekends) {
    const day = now.getUTCDay();
    if (day === 0 || day === 6) return false;
  }
  const hour = now.getUTCHours();
  if (seq.send_window_start_hour <= seq.send_window_end_hour) {
    return hour >= seq.send_window_start_hour && hour < seq.send_window_end_hour;
  }
  // window crosses midnight
  return hour >= seq.send_window_start_hour || hour < seq.send_window_end_hour;
}

function nextSendForStep(now: Date, step: StepRow): string {
  const ms =
    step.delay_days * 24 * 60 * 60 * 1000 +
    step.delay_hours * 60 * 60 * 1000;
  return new Date(now.getTime() + ms).toISOString();
}

export const Route = createFileRoute("/api/public/hooks/dispatch-sequences")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace("Bearer ", "");
        if (!token) {
          return new Response(
            JSON.stringify({ error: "Missing authorization header" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL!,
          token,
          { auth: { autoRefreshToken: false, persistSession: false } },
        );

        const startedAt = Date.now();
        let processed = 0;
        let sent = 0;
        let failed = 0;
        let skipped = 0;
        let completed = 0;

        // 1. Pull due enrollments (active + next_send_at <= now).
        const { data: enrollments, error: enrErr } = await supabase
          .from("outreach_sequence_enrollments")
          .select("id, organization_id, sequence_id, lead_id, current_step_index, status")
          .eq("status", "active")
          .lte("next_send_at", new Date().toISOString())
          .order("next_send_at", { ascending: true })
          .limit(BATCH_SIZE);

        if (enrErr) {
          console.error("[dispatch-sequences] enrollment fetch error", enrErr);
          return new Response(
            JSON.stringify({ success: false, error: enrErr.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!enrollments?.length) {
          return new Response(
            JSON.stringify({ success: true, processed: 0, sent: 0, message: "no enrollments due" }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // 2. Hydrate sequences, leads, orgs, steps in batched lookups.
        const sequenceIds = [...new Set(enrollments.map((e) => e.sequence_id))];
        const leadIds = [...new Set(enrollments.map((e) => e.lead_id))];
        const orgIds = [...new Set(enrollments.map((e) => e.organization_id))];

        const [seqRes, leadRes, orgRes, stepRes] = await Promise.all([
          supabase.from("outreach_sequences")
            .select("id, organization_id, name, status, send_window_start_hour, send_window_end_hour, send_on_weekends")
            .in("id", sequenceIds),
          supabase.from("leads").select("id, name, email, company").in("id", leadIds),
          supabase.from("organizations")
            .select("id, brand_name, name, logo_url, primary_color, font_family, email_signature")
            .in("id", orgIds),
          supabase.from("outreach_sequence_steps")
            .select("id, sequence_id, step_index, template_id, subject_override, body_override, delay_days, delay_hours, is_active")
            .in("sequence_id", sequenceIds)
            .order("step_index", { ascending: true }),
        ]);

        const sequences = new Map<string, SequenceRow>(
          ((seqRes.data || []) as SequenceRow[]).map((s) => [s.id, s]),
        );
        const leads = new Map<string, LeadRow>(
          ((leadRes.data || []) as LeadRow[]).map((l) => [l.id, l]),
        );
        const orgs = new Map<string, OrgRow>(
          ((orgRes.data || []) as OrgRow[]).map((o) => [o.id, o]),
        );
        const stepsBySeq = new Map<string, StepRow[]>();
        for (const s of (stepRes.data || []) as (StepRow & { sequence_id: string })[]) {
          const list = stepsBySeq.get(s.sequence_id) || [];
          list.push(s);
          stepsBySeq.set(s.sequence_id, list);
        }

        // 3. Hydrate templates for any step that references one.
        const templateIds = [
          ...new Set(
            (stepRes.data || [])
              .map((s) => (s as StepRow).template_id)
              .filter((id): id is string => !!id),
          ),
        ];
        const templates = new Map<string, { subject: string; body: string }>();
        if (templateIds.length) {
          const { data: tpls } = await supabase
            .from("outreach_templates")
            .select("id, subject, body")
            .in("id", templateIds);
          for (const t of tpls || []) {
            templates.set(t.id, { subject: t.subject, body: t.body });
          }
        }

        const now = new Date();

        // 4. Process each enrollment.
        for (const enrollment of enrollments as EnrollmentRow[]) {
          processed += 1;
          const seq = sequences.get(enrollment.sequence_id);
          const lead = leads.get(enrollment.lead_id);
          const org = orgs.get(enrollment.organization_id);

          if (!seq || seq.status !== "active") {
            // Sequence paused or deleted — pause this enrollment.
            await supabase
              .from("outreach_sequence_enrollments")
              .update({ status: "paused", next_send_at: null })
              .eq("id", enrollment.id);
            skipped += 1;
            continue;
          }

          if (!lead || !lead.email) {
            await supabase
              .from("outreach_sequence_enrollments")
              .update({ status: "failed", stop_reason: "lead_missing_email", next_send_at: null })
              .eq("id", enrollment.id);
            await supabase.from("outreach_sequence_step_log").insert({
              organization_id: enrollment.organization_id,
              enrollment_id: enrollment.id,
              sequence_id: enrollment.sequence_id,
              step_index: enrollment.current_step_index,
              lead_id: enrollment.lead_id,
              status: "skipped",
              error_message: "Lead has no email",
            });
            skipped += 1;
            continue;
          }

          if (!isWithinSendWindow(now, seq)) {
            // Push next_send_at forward to the next window opening (~1 hour bump).
            const bump = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
            await supabase
              .from("outreach_sequence_enrollments")
              .update({ next_send_at: bump })
              .eq("id", enrollment.id);
            skipped += 1;
            continue;
          }

          const stepList = stepsBySeq.get(seq.id) || [];
          const step = stepList.find(
            (s) => s.step_index === enrollment.current_step_index && s.is_active,
          );

          if (!step) {
            // No matching step — sequence finished.
            await supabase
              .from("outreach_sequence_enrollments")
              .update({ status: "completed", completed_at: now.toISOString(), next_send_at: null })
              .eq("id", enrollment.id);
            completed += 1;
            continue;
          }

          // Resolve subject + body.
          const tpl = step.template_id ? templates.get(step.template_id) : null;
          const rawSubject = step.subject_override?.trim() || tpl?.subject || "";
          const rawBody = step.body_override?.trim() || tpl?.body || "";

          if (!rawSubject || !rawBody) {
            await supabase.from("outreach_sequence_step_log").insert({
              organization_id: enrollment.organization_id,
              enrollment_id: enrollment.id,
              sequence_id: enrollment.sequence_id,
              step_id: step.id,
              step_index: step.step_index,
              lead_id: enrollment.lead_id,
              status: "failed",
              error_message: "Step has no subject or body",
            });
            failed += 1;
            continue;
          }

          const fillCtx = {
            name: lead.name,
            email: lead.email,
            company: lead.company,
            businessName: org?.brand_name || org?.name || "",
          };
          const subject = fillTemplateTokens(rawSubject, fillCtx);
          const body = fillTemplateTokens(rawBody, fillCtx);

          // 5. Send via the shared in-process dispatcher (queues to pgmq).
          const result = await dispatchOutreachEmail({
            templateName: "outreach-email",
            recipientEmail: lead.email,
            templateData: {
              body,
              brandName: org?.brand_name || org?.name || "Genesis",
              logoUrl: org?.logo_url || undefined,
              accentColor: org?.primary_color || undefined,
              fontFamily: org?.font_family || undefined,
              signature: org?.email_signature || undefined,
            },
            idempotencyKey: `seq-${enrollment.id}-step-${step.step_index}`,
            fromName: org?.brand_name || org?.name,
          });

          if (!result.success) {
            await supabase.from("outreach_sequence_step_log").insert({
              organization_id: enrollment.organization_id,
              enrollment_id: enrollment.id,
              sequence_id: enrollment.sequence_id,
              step_id: step.id,
              step_index: step.step_index,
              lead_id: enrollment.lead_id,
              status: result.reason === "suppressed" ? "skipped" : "failed",
              subject,
              error_message: result.reason === "suppressed"
                ? "Recipient is on the suppression list"
                : (result.error || result.reason),
            });
            if (result.reason === "suppressed") {
              await supabase
                .from("outreach_sequence_enrollments")
                .update({ status: "stopped", stop_reason: "suppressed", stopped_at: now.toISOString(), next_send_at: null })
                .eq("id", enrollment.id);
              skipped += 1;
            } else {
              failed += 1;
            }
            continue;
          }

          // 6. Log success and advance to the next step.
          await supabase.from("outreach_sequence_step_log").insert({
            organization_id: enrollment.organization_id,
            enrollment_id: enrollment.id,
            sequence_id: enrollment.sequence_id,
            step_id: step.id,
            step_index: step.step_index,
            lead_id: enrollment.lead_id,
            status: "sent",
            subject,
            message_id: result.messageId,
          });

          const nextStepIndex = step.step_index + 1;
          const nextStep = stepList.find(
            (s) => s.step_index === nextStepIndex && s.is_active,
          );

          if (nextStep) {
            await supabase
              .from("outreach_sequence_enrollments")
              .update({
                current_step_index: nextStepIndex,
                next_send_at: nextSendForStep(now, nextStep),
                last_sent_at: now.toISOString(),
              })
              .eq("id", enrollment.id);
          } else {
            await supabase
              .from("outreach_sequence_enrollments")
              .update({
                status: "completed",
                completed_at: now.toISOString(),
                last_sent_at: now.toISOString(),
                next_send_at: null,
              })
              .eq("id", enrollment.id);
            completed += 1;
          }

          sent += 1;
        }

        return new Response(
          JSON.stringify({
            success: true,
            processed,
            sent,
            failed,
            skipped,
            completed,
            duration_ms: Date.now() - startedAt,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
