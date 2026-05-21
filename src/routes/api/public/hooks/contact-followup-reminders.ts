/**
 * Cron-triggered hook: scans contact_submissions for entries that are still
 * in `received` status more than 24 hours after they came in (i.e. nobody
 * has marked them as replied) and emails the owner a follow-up reminder.
 *
 * Fires hourly via pg_cron. Each submission is reminded at most once per
 * 24h (tracked via contact_submissions.last_reminder_at).
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";

type AdminClient = SupabaseClient<any, any, any, any, any>;

const FROM_DISPLAY_NAME = "VireCRM Contact Form";
const REMINDER_DELAY_HOURS = 24;
const REMINDER_COOLDOWN_HOURS = 24;
const BATCH_LIMIT = 50;

export const Route = createFileRoute("/api/public/hooks/contact-followup-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !SERVICE_KEY) {
          return Response.json({ error: "Missing service credentials" }, { status: 500 });
        }
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY) as AdminClient;

        const templateDef = TEMPLATES["contact-followup-reminder"];
        if (!templateDef?.to) {
          return Response.json({ error: "Reminder template misconfigured" }, { status: 500 });
        }
        const recipient = templateDef.to;

        const now = Date.now();
        const olderThan = new Date(now - REMINDER_DELAY_HOURS * 3600 * 1000).toISOString();
        const cooldownCutoff = new Date(now - REMINDER_COOLDOWN_HOURS * 3600 * 1000).toISOString();

        // Pull candidates: still received, no reply, older than 24h, and either
        // never reminded or last reminded > 24h ago.
        const { data: candidates, error: fetchErr } = await supabase
          .from("contact_submissions")
          .select(
            "id, name, email, company, phone, budget, message, created_at, last_reminder_at, replied_at, status, test_mode",
          )
          .eq("status", "received")
          .is("replied_at", null)
          .eq("test_mode", false)
          .lte("created_at", olderThan)
          .or(`last_reminder_at.is.null,last_reminder_at.lte.${cooldownCutoff}`)
          .order("created_at", { ascending: true })
          .limit(BATCH_LIMIT);

        if (fetchErr) {
          return Response.json({ error: fetchErr.message }, { status: 500 });
        }

        if (!candidates || candidates.length === 0) {
          return Response.json({ ok: true, reminded: 0, ran_at: new Date().toISOString() });
        }

        // Fast-path: skip if owner inbox is suppressed (avoids DB work per-candidate).
        const { data: suppressed } = await supabase
          .from("suppressed_emails")
          .select("id")
          .eq("email", recipient.toLowerCase())
          .maybeSingle();
        if (suppressed) {
          return Response.json({ ok: true, reminded: 0, note: "Owner inbox suppressed" });
        }

        let remindedCount = 0;
        const errors: Array<{ id: string; error: string }> = [];

        for (const sub of candidates) {
          try {
            const hoursElapsed = Math.floor(
              (now - new Date(sub.created_at).getTime()) / (3600 * 1000),
            );

            const result = await sendTransactionalEmail({
              supabase,
              templateName: "contact-followup-reminder",
              templateData: {
                name: sub.name,
                email: sub.email,
                company: sub.company,
                phone: sub.phone,
                budget: sub.budget,
                message: sub.message,
                receivedAt: new Date(sub.created_at).toISOString(),
                hoursElapsed,
              },
              fromName: FROM_DISPLAY_NAME,
              replyTo: sub.email,
              idempotencyKey: `contact-reminder-${sub.id}-${Math.floor(now / (3600 * 1000 * REMINDER_COOLDOWN_HOURS))}`,
            });

            if (result.success) {
              // Stamp the submission so we don't re-fire for another 24h.
              await supabase
                .from("contact_submissions")
                .update({ last_reminder_at: new Date().toISOString() } as any)
                .eq("id", sub.id);
              remindedCount += 1;
            } else if (result.reason !== "suppressed") {
              errors.push({ id: sub.id, error: result.error ?? result.reason });
            }
          } catch (err) {
            errors.push({
              id: sub.id,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        return Response.json({
          ok: true,
          reminded: remindedCount,
          errors: errors.length ? errors : undefined,
          ran_at: new Date().toISOString(),
        });
      },
    },
  },
});
