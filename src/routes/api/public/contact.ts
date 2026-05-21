/**
 * Public contact-form intake. Anyone on the marketing site can POST here
 * without auth. Validates input, applies a basic IP rate-limit, then
 * pre-renders the `contact-inquiry` template and drops it on the
 * transactional email queue. The dispatcher (process-email-queue) sends it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { classifyAndStore } from "@/lib/contact/classify-submission";
import { keepAlive } from "@/lib/cloudflare/context";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";

type AdminClient = SupabaseClient<any, any, any, any, any>;

import { PLATFORM_DOMAIN } from "@/config/domains";
const FROM_DISPLAY_NAME = "VireCRM Contact Form";

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

        const testMode = getTestModeConfig();
        const intendedRecipient = template.to;

        const ownerTemplateData = {
          name: payload.name,
          email: payload.email,
          company: payload.company || null,
          phone: payload.phone || null,
          budget: payload.budget || null,
          message: payload.message,
        };
        const ownerIdempotencyKey = `contact-${crypto.randomUUID()}`;

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
            message_id: ownerIdempotencyKey,
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

        // AI classification runs in the background — never blocks the
        // response or email delivery. `keepAlive` keeps the promise alive
        // past the Response on Cloudflare Workers (via ctx.waitUntil
        // sourced from the AsyncLocalStorage frame in src/server.ts);
        // on Node it awaits inline. The classify-contact-submissions
        // cron sweeper is the backstop for any submission that still
        // ends up with classified_at IS NULL.
        if (insertedSubmission?.id) {
          const classifyPromise = classifyAndStore(supabase, {
            id: insertedSubmission.id,
            name: payload.name,
            email: payload.email,
            company: payload.company || null,
            message: payload.message,
            budget: payload.budget || null,
          }).catch((err) => {
            console.warn("contact: inline classify failed (non-fatal)", err);
          });
          await keepAlive(classifyPromise);
        }

        const ownerResult = await sendTransactionalEmail({
          supabase,
          templateName: "contact-inquiry",
          templateData: ownerTemplateData,
          recipientOverride: testMode.enabled && testMode.inbox ? testMode.inbox : undefined,
          fromName: FROM_DISPLAY_NAME,
          replyTo: payload.email,
          idempotencyKey: ownerIdempotencyKey,
        });

        if (!ownerResult.success) {
          if (ownerResult.reason === "suppressed") {
            console.warn("contact: inbox is suppressed", { testMode: testMode.enabled });
            return jsonError("We could not deliver your message right now.", 500);
          }
          console.error("contact: enqueue failed", ownerResult.error);
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

  const ackTemplate = TEMPLATES["contact-acknowledgment"];
  if (!ackTemplate) {
    console.warn("contact: acknowledgment template missing — skipping");
    return;
  }

  const pricingUrl = origin ? `${origin}/pricing` : `https://${PLATFORM_DOMAIN}/pricing`;
  const ackData = {
    name: visitorName,
    message: visitorMessage,
    pricingUrl,
  };

  const ackResult = await sendTransactionalEmail({
    supabase,
    templateName: "contact-acknowledgment",
    templateData: ackData,
    recipientEmail: visitorEmail,
    fromName: FROM_DISPLAY_NAME,
    idempotencyKey: `contact-ack-${crypto.randomUUID()}`,
  });

  if (!ackResult.success && ackResult.reason !== "suppressed") {
    console.warn("contact: ack enqueue failed (non-fatal)", ackResult.error);
  }
}
