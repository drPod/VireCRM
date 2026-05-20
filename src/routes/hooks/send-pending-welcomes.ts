import * as React from "react";
import { render } from "@react-email/components";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { TEMPLATES } from "@/lib/email-templates/registry";

// Match the constants used by the transactional send route.
const SITE_NAME = "VireCRM";
const SENDER_DOMAIN = "notify.virecrm.com";
const FROM_DOMAIN = "notify.virecrm.com";

const TEMPLATE_NAME = "client-welcome";
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Cron-triggered route that sends scheduled client welcome emails.
 *
 * Runs every minute. For each row in `pending_welcome_emails` whose
 * `send_after` has passed and which hasn't been sent or failed, it:
 *   1. Renders the welcome template
 *   2. Skips suppressed recipients
 *   3. Reuses or creates an unsubscribe token
 *   4. Enqueues the email onto the existing `transactional_emails` queue
 *   5. Marks the row as sent (or records the error and bumps attempts)
 *
 * Idempotency: each pending row has a unique `id` used as the idempotency
 * key, and rows are marked `sent_at` immediately after enqueue.
 */
export const Route = createFileRoute("/hooks/send-pending-welcomes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Cron-only endpoint — gated by a shared secret, not a JWT, since
        // pg_cron has no user identity. Matches sibling hooks.
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Pull due, un-sent rows
        const { data: rows, error: fetchErr } = await supabase
          .from("pending_welcome_emails")
          .select("id, recipient_email, full_name, brand_name, login_url, attempts, reseller_id")
          .is("sent_at", null)
          .is("failed_at", null)
          .lte("send_after", new Date().toISOString())
          .lt("attempts", MAX_ATTEMPTS)
          .order("send_after", { ascending: true })
          .limit(BATCH_SIZE);

        if (fetchErr) {
          console.error("Failed to fetch pending welcome emails:", fetchErr);
          return new Response(JSON.stringify({ success: false, error: fetchErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!rows || rows.length === 0) {
          return new Response(JSON.stringify({ success: true, processed: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // Batch-load reseller branding so reply-to / from-name match the
        // reseller the client signed up under (white-label experience).
        const resellerIds = Array.from(new Set(rows.map((r) => r.reseller_id).filter(Boolean)));
        const resellerBranding = new Map<
          string,
          { brand_name: string | null; support_email: string | null }
        >();
        if (resellerIds.length > 0) {
          const { data: resellerRows } = await supabase
            .from("organizations")
            .select("id, brand_name, name, support_email")
            .in("id", resellerIds);
          for (const r of resellerRows ?? []) {
            resellerBranding.set(r.id, {
              brand_name: r.brand_name ?? r.name ?? null,
              support_email: r.support_email ?? null,
            });
          }
        }

        const template = TEMPLATES[TEMPLATE_NAME];
        if (!template) {
          console.error(`Template '${TEMPLATE_NAME}' missing from registry`);
          return new Response(JSON.stringify({ success: false, error: "Template missing" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const row of rows) {
          try {
            const recipient = row.recipient_email.toLowerCase();

            // Suppression check
            const { data: suppressed } = await supabase
              .from("suppressed_emails")
              .select("id")
              .eq("email", recipient)
              .maybeSingle();

            if (suppressed) {
              await supabase
                .from("pending_welcome_emails")
                .update({ sent_at: new Date().toISOString(), last_error: "suppressed" })
                .eq("id", row.id);
              skipped++;
              continue;
            }

            // Unsubscribe token (reuse if exists)
            let unsubscribeToken: string;
            const { data: existingToken } = await supabase
              .from("email_unsubscribe_tokens")
              .select("token, used_at")
              .eq("email", recipient)
              .maybeSingle();

            if (existingToken && !existingToken.used_at) {
              unsubscribeToken = existingToken.token;
            } else if (!existingToken) {
              unsubscribeToken = generateToken();
              await supabase
                .from("email_unsubscribe_tokens")
                .upsert(
                  { token: unsubscribeToken, email: recipient },
                  { onConflict: "email", ignoreDuplicates: true },
                );
              const { data: storedToken } = await supabase
                .from("email_unsubscribe_tokens")
                .select("token")
                .eq("email", recipient)
                .maybeSingle();
              if (!storedToken) throw new Error("Failed to store unsubscribe token");
              unsubscribeToken = storedToken.token;
            } else {
              // token used → treat as suppressed
              await supabase
                .from("pending_welcome_emails")
                .update({ sent_at: new Date().toISOString(), last_error: "unsubscribed" })
                .eq("id", row.id);
              skipped++;
              continue;
            }

            const templateData = {
              brandName: row.brand_name,
              fullName: row.full_name,
              loginUrl: row.login_url,
            };
            const element = React.createElement(template.component, templateData);
            const html = await render(element);
            const plainText = await render(element, { plainText: true });
            const subject =
              typeof template.subject === "function"
                ? template.subject(templateData)
                : template.subject;

            const messageId = crypto.randomUUID();

            await supabase.from("email_send_log").insert({
              message_id: messageId,
              template_name: TEMPLATE_NAME,
              recipient_email: row.recipient_email,
              status: "pending",
            });

            const branding = row.reseller_id ? resellerBranding.get(row.reseller_id) : undefined;
            const fromDisplayName = branding?.brand_name?.trim() || row.brand_name || SITE_NAME;
            const safeFromName = fromDisplayName.replace(/["<>\r\n]/g, "").slice(0, 100);
            const replyTo = branding?.support_email?.trim().toLowerCase();

            const { error: enqueueErr } = await supabase.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: {
                message_id: messageId,
                to: row.recipient_email,
                from: `${safeFromName} <noreply@${FROM_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                subject,
                html,
                text: plainText,
                purpose: "transactional",
                label: TEMPLATE_NAME,
                idempotency_key: `welcome-${row.id}`,
                unsubscribe_token: unsubscribeToken,
                reply_to: replyTo || undefined,
                queued_at: new Date().toISOString(),
              },
            });

            if (enqueueErr) throw new Error(enqueueErr.message);

            await supabase
              .from("pending_welcome_emails")
              .update({ sent_at: new Date().toISOString() })
              .eq("id", row.id);

            sent++;
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            const nextAttempts = (row.attempts ?? 0) + 1;
            const isFinal = nextAttempts >= MAX_ATTEMPTS;
            await supabase
              .from("pending_welcome_emails")
              .update({
                attempts: nextAttempts,
                last_error: message,
                failed_at: isFinal ? new Date().toISOString() : null,
              })
              .eq("id", row.id);
            failed++;
            console.error("Welcome email send failed", { id: row.id, message });
          }
        }

        return new Response(
          JSON.stringify({ success: true, processed: rows.length, sent, skipped, failed }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
