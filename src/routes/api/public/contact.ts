/**
 * Public contact-form intake. Anyone on the marketing site can POST here
 * without auth. Validates input, applies a basic IP rate-limit, then
 * pre-renders the `contact-inquiry` template and drops it on the
 * transactional email queue. The dispatcher (process-email-queue) sends it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { render } from "@react-email/components";
import { z } from "zod";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { classifyAndStore } from "@/lib/contact/classify-submission";

type AdminClient = SupabaseClient<any, any, any, any, any>;

const SENDER_DOMAIN = "notify.vireonx.space";
const FROM_DOMAIN = "vireonx.space";
const FROM_DISPLAY_NAME = "Genesis Contact Form";

/**
 * Test mode — when CONTACT_TEST_MODE=true, every contact submission is
 * redirected to CONTACT_TEST_INBOX instead of the real owner inbox AND the
 * visitor's address. Subjects are prefixed with [TEST MODE] and the original
 * intended recipient is preserved in metadata so QA can verify routing
 * without spamming real users. Flip CONTACT_TEST_MODE to false (or unset)
 * to enable production delivery.
 */
function getTestModeConfig(): { enabled: boolean; inbox: string | null } {
  const enabled = (process.env.CONTACT_TEST_MODE ?? "").toLowerCase() === "true";
  const inbox = process.env.CONTACT_TEST_INBOX?.trim() || null;
  if (enabled && !inbox) {
    console.warn(
      "contact: CONTACT_TEST_MODE is on but CONTACT_TEST_INBOX is unset — falling back to production delivery",
    );
    return { enabled: false, inbox: null };
  }
  return { enabled, inbox };
}

const PROJECT_TYPES = [
  "custom-crm",
  "white-label",
  "full-ownership",
  "enterprise",
  "integration",
  "other",
] as const;

const ContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Invalid email").max(255).toLowerCase(),
  company: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  budget: z.string().trim().max(50).optional().nullable(),
  // Optional analytics signal — what kind of engagement the visitor selected.
  // Stored on its own column so reports can group submissions over time.
  projectType: z.enum(PROJECT_TYPES).optional().nullable(),
  message: z.string().trim().min(1, "Message is required").max(4000),
  // Honeypot — real users leave it empty. Bots fill it in.
  website: z.string().max(0).optional().nullable(),
  // Math CAPTCHA — server re-checks a + b === answer. Required: making
  // this `.optional()` previously allowed bots to bypass the check entirely
  // by simply omitting the field.
  captcha: z.object({
    a: z.number().int().min(0).max(20),
    b: z.number().int().min(0).max(20),
    answer: z.number().int().min(0).max(40),
  }),
});

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

export const Route = createFileRoute("/api/public/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error("contact: missing supabase env vars");
          return jsonError("Server not configured", 500);
        }

        // Parse + validate body
        let payload: z.infer<typeof ContactSchema>;
        try {
          const raw = await request.json();
          payload = ContactSchema.parse(raw);
        } catch (err) {
          const detail =
            err instanceof z.ZodError
              ? err.issues.map((i) => i.message).join(", ")
              : "Invalid request";
          return jsonError(detail, 400);
        }

        // Honeypot tripped — pretend success but drop silently.
        if (payload.website && payload.website.length > 0) {
          return Response.json({ success: true });
        }

        // CAPTCHA — server re-verifies the math answer. Reject mismatches
        // outright (vs. silently dropping) so legitimate users with a typo
        // get a clear error and can retry.
        {
          const { a, b, answer } = payload.captcha;
          if (a + b !== answer) {
            return jsonError("Incorrect answer to the security question.", 400);
          }
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey) as AdminClient;

        // Per-IP rate limit (defense in depth alongside honeypot + CAPTCHA):
        //   - max 5 submissions per 10 minutes (short-burst spam)
        //   - max 20 submissions per 24 hours (sustained spam)
        // Counted against the contact_submissions audit table where the IP
        // is stored cleanly, instead of a brittle ILIKE on email_send_log.
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";

        if (ip !== "unknown") {
          const now = Date.now();
          const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
          const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

          const [{ count: shortCount }, { count: dayCount }] = await Promise.all([
            supabase
              .from("contact_submissions")
              .select("id", { count: "exact", head: true })
              .eq("ip_address", ip)
              .gte("created_at", tenMinAgo),
            supabase
              .from("contact_submissions")
              .select("id", { count: "exact", head: true })
              .eq("ip_address", ip)
              .gte("created_at", dayAgo),
          ]);

          if ((shortCount ?? 0) >= 5 || (dayCount ?? 0) >= 20) {
            return jsonError("Too many submissions — please try again later.", 429);
          }
        }

        // Deduplication — if the same visitor (email) sent the exact same
        // message within the last hour, treat it as a duplicate submit
        // (double-clicks, retries, browser back+resubmit). Return success
        // so the UI shows the normal confirmation, but skip storage and
        // skip re-emailing. We compare on a normalized message hash so
        // trivial whitespace differences don't bypass the check.
        const DEDUP_WINDOW_MINUTES = 60;
        const normalizedMessage = payload.message.trim().replace(/\s+/g, " ").toLowerCase();
        const messageHashBuf = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(`${payload.email}|${normalizedMessage}`),
        );
        const messageHash = Array.from(new Uint8Array(messageHashBuf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();

        const { data: dupRow } = await supabase
          .from("contact_submissions")
          .select("id")
          .eq("email", payload.email)
          .eq("metadata->>dedup_hash", messageHash)
          .gte("created_at", dedupSince)
          .limit(1)
          .maybeSingle();

        if (dupRow) {
          console.info("contact: duplicate submission suppressed", {
            email: payload.email,
            existingId: dupRow.id,
          });
          return Response.json({ success: true, deduplicated: true });
        }

        // Resolve template (recipient is hard-locked via template.to)
        const template = TEMPLATES["contact-inquiry"];
        if (!template || !template.to) {
          console.error("contact: template missing or has no fixed recipient");
          return jsonError("Email template misconfigured", 500);
        }

        // Test mode: redirect owner notifications to the sandbox inbox so
        // QA can validate the full delivery path without paging the real
        // owner. The original intended recipient is preserved in metadata.
        const testMode = getTestModeConfig();
        const intendedRecipient = template.to;
        const recipient = testMode.enabled && testMode.inbox ? testMode.inbox : intendedRecipient;
        const subjectPrefix = testMode.enabled ? "[TEST MODE] " : "";

        // Skip if the (effective) inbox is on the suppression list.
        const { data: suppressed } = await supabase
          .from("suppressed_emails")
          .select("id")
          .eq("email", recipient.toLowerCase())
          .maybeSingle();

        if (suppressed) {
          console.warn("contact: inbox is suppressed", { recipient, testMode: testMode.enabled });
          // Surface a non-leaky error to the visitor.
          return jsonError("We could not deliver your message right now.", 500);
        }

        // Reuse-or-create unsubscribe token (required by enqueue contract,
        // even though the recipient is the site owner / sandbox inbox).
        let unsubscribeToken: string;
        const { data: existingToken } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token, used_at")
          .eq("email", recipient.toLowerCase())
          .maybeSingle();

        if (existingToken && !existingToken.used_at) {
          unsubscribeToken = existingToken.token;
        } else {
          unsubscribeToken = generateToken();
          await supabase
            .from("email_unsubscribe_tokens")
            .upsert({ token: unsubscribeToken, email: recipient.toLowerCase() } as any, {
              onConflict: "email",
              ignoreDuplicates: true,
            });
          const { data: stored } = await supabase
            .from("email_unsubscribe_tokens")
            .select("token")
            .eq("email", recipient.toLowerCase())
            .maybeSingle();
          unsubscribeToken = stored?.token ?? unsubscribeToken;
        }

        // Render React Email template -> HTML + plain text
        const templateData = {
          name: payload.name,
          email: payload.email,
          company: payload.company || null,
          phone: payload.phone || null,
          budget: payload.budget || null,
          message: payload.message,
        };
        const element = React.createElement(template.component, templateData);
        const html = await render(element);
        const plainText = await render(element, { plainText: true });
        const baseSubject =
          typeof template.subject === "function"
            ? template.subject(templateData)
            : template.subject;
        const subject = `${subjectPrefix}${baseSubject}`;

        const messageId = crypto.randomUUID();
        const idempotencyKey = `contact-${messageId}`;

        // Persist the submission to the CRM audit table for follow-up.
        // Failure here must NEVER block delivery — log and continue.
        const userAgent = request.headers.get("user-agent");
        const origin = request.headers.get("origin");
        const { data: insertedSubmission, error: crmInsertErr } = await supabase
          .from("contact_submissions")
          .insert({
            name: payload.name,
            email: payload.email,
            company: payload.company || null,
            phone: payload.phone || null,
            budget: payload.budget || null,
            project_type: payload.projectType || null,
            message: payload.message,
            ip_address: ip === "unknown" ? null : ip,
            user_agent: userAgent,
            origin,
            test_mode: testMode.enabled,
            message_id: messageId,
            status: "received",
            metadata: {
              intended_recipient: testMode.enabled ? intendedRecipient : undefined,
              dedup_hash: messageHash,
              project_type: payload.projectType || undefined,
            },
          } as any)
          .select("id")
          .maybeSingle();
        if (crmInsertErr) {
          console.warn("contact: failed to persist CRM submission (non-fatal)", crmInsertErr);
        }

        // Fire-and-forget AI classification. Never blocks the response or
        // email delivery — failures are stamped on the row for the cron
        // sweeper to retry.
        if (insertedSubmission?.id) {
          void classifyAndStore(supabase, {
            id: insertedSubmission.id,
            name: payload.name,
            email: payload.email,
            company: payload.company || null,
            message: payload.message,
            budget: payload.budget || null,
          }).catch((err) => {
            console.warn("contact: inline classify failed (non-fatal)", err);
          });
        }

        // Stamp the log row with the IP so the rate limiter above can see it.
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "contact-inquiry",
          recipient_email: recipient,
          status: "pending",
          metadata: {
            subject,
            body_preview: plainText.replace(/\s+/g, " ").trim().slice(0, 200),
            visitor_email: payload.email,
            test_mode: testMode.enabled,
            intended_recipient: testMode.enabled ? intendedRecipient : undefined,
          },
          error_message: `ip:${ip}`,
        } as any);

        const { error: enqueueErr } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageId,
            to: recipient,
            from: `${FROM_DISPLAY_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            body_preview: plainText.slice(0, 200),
            html,
            text: plainText,
            purpose: "transactional",
            label: testMode.enabled ? "contact-inquiry-test" : "contact-inquiry",
            idempotency_key: idempotencyKey,
            unsubscribe_token: unsubscribeToken,
            // Replies route back to the visitor.
            reply_to: payload.email,
            queued_at: new Date().toISOString(),
          },
        } as any);

        if (enqueueErr) {
          console.error("contact: enqueue failed", enqueueErr);
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: "contact-inquiry",
            recipient_email: recipient,
            status: "failed",
            error_message: "Failed to enqueue contact inquiry",
          } as any);
          return jsonError("We could not deliver your message right now.", 500);
        }

        // Best-effort acknowledgment to the visitor. Failure here must NEVER
        // bubble up — the owner already has the inquiry, and the visitor
        // already saw the on-screen "Message sent" confirmation.
        try {
          await sendVisitorAcknowledgment({
            supabase,
            visitorName: payload.name,
            visitorEmail: payload.email,
            visitorMessage: payload.message,
            origin: request.headers.get("origin"),
          });
        } catch (ackErr) {
          console.warn("contact: visitor acknowledgment failed (non-fatal)", ackErr);
        }

        return Response.json({ success: true });
      },

      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
});

/**
 * Best-effort acknowledgment back to the visitor. Mirrors the
 * enqueue-to-pgmq pattern used for the owner notification above so that
 * retries, rate-limit handling, and dead-letter routing work the same way.
 */
async function sendVisitorAcknowledgment(args: {
  supabase: AdminClient;
  visitorName: string;
  visitorEmail: string;
  visitorMessage: string;
  origin: string | null;
}) {
  const { supabase, visitorName, visitorEmail, visitorMessage, origin } = args;

  // Test mode: redirect the visitor acknowledgment to the sandbox inbox so
  // QA isn't sent to a real visitor while we're validating delivery. The
  // intended visitor address is preserved in metadata.
  const testMode = getTestModeConfig();
  const intendedRecipient = visitorEmail.toLowerCase();
  const recipient =
    testMode.enabled && testMode.inbox ? testMode.inbox.toLowerCase() : intendedRecipient;
  const subjectPrefix = testMode.enabled ? "[TEST MODE] " : "";

  // Don't email recipients who previously unsubscribed/bounced.
  const { data: suppressed } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", recipient)
    .maybeSingle();
  if (suppressed) return;

  const ackTemplate = TEMPLATES["contact-acknowledgment"];
  if (!ackTemplate) {
    console.warn("contact: acknowledgment template missing — skipping");
    return;
  }

  // One-token-per-recipient mapping (required by enqueue contract).
  let unsubscribeToken: string;
  const { data: existingToken } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", recipient)
    .maybeSingle();

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token;
  } else {
    unsubscribeToken = generateToken();
    await supabase
      .from("email_unsubscribe_tokens")
      .upsert({ token: unsubscribeToken, email: recipient } as any, {
        onConflict: "email",
        ignoreDuplicates: true,
      });
    const { data: stored } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", recipient)
      .maybeSingle();
    unsubscribeToken = stored?.token ?? unsubscribeToken;
  }

  const pricingUrl = origin ? `${origin}/pricing` : "https://genesisx.space/pricing";
  const ackData = {
    name: visitorName,
    message: visitorMessage,
    pricingUrl,
  };

  const ackElement = React.createElement(ackTemplate.component, ackData);
  const ackHtml = await render(ackElement);
  const ackText = await render(ackElement, { plainText: true });
  const baseAckSubject =
    typeof ackTemplate.subject === "function" ? ackTemplate.subject(ackData) : ackTemplate.subject;
  const ackSubject = `${subjectPrefix}${baseAckSubject}`;

  const ackMessageId = crypto.randomUUID();

  await supabase.from("email_send_log").insert({
    message_id: ackMessageId,
    template_name: "contact-acknowledgment",
    recipient_email: recipient,
    status: "pending",
    metadata: {
      subject: ackSubject,
      body_preview: ackText.replace(/\s+/g, " ").trim().slice(0, 200),
      test_mode: testMode.enabled,
      intended_recipient: testMode.enabled ? intendedRecipient : undefined,
    },
  } as any);

  const { error: ackEnqueueErr } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: ackMessageId,
      to: recipient,
      from: `${FROM_DISPLAY_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: ackSubject,
      body_preview: ackText.slice(0, 200),
      html: ackHtml,
      text: ackText,
      purpose: "transactional",
      label: testMode.enabled ? "contact-acknowledgment-test" : "contact-acknowledgment",
      idempotency_key: `contact-ack-${ackMessageId}`,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  } as any);

  if (ackEnqueueErr) {
    console.warn("contact: ack enqueue failed (non-fatal)", ackEnqueueErr);
    await supabase.from("email_send_log").insert({
      message_id: ackMessageId,
      template_name: "contact-acknowledgment",
      recipient_email: recipient,
      status: "failed",
      error_message: "Failed to enqueue acknowledgment",
    } as any);
  }
}
