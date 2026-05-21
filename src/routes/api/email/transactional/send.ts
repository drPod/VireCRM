import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";

function redactEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "***";
  return `${localPart[0]}***@${domain}`;
}

export const Route = createFileRoute("/api/email/transactional/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error("Missing required environment variables");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Verify the caller has a valid Supabase auth token.
        // In TanStack, there is no Supabase gateway — we validate the JWT ourselves.
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.slice("Bearer ".length).trim();
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(token);

        if (authError || !user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse request body
        let templateName: string;
        let recipientEmail: string;
        let idempotencyKey: string;
        let templateData: Record<string, any> = {};
        let fromName: string | null = null;
        let replyTo: string | null = null;
        try {
          const body = await request.json();
          templateName = body.templateName || body.template_name;
          recipientEmail = body.recipientEmail || body.recipient_email;
          const messageId = crypto.randomUUID();
          idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId;
          if (body.templateData && typeof body.templateData === "object") {
            templateData = body.templateData;
          }
          if (typeof body.fromName === "string" && body.fromName.trim()) {
            // Sanitize: strip any chars that would break the From header
            fromName = body.fromName
              .trim()
              .replace(/["<>\r\n]/g, "")
              .slice(0, 100);
          }
          if (typeof body.replyTo === "string" && body.replyTo.trim()) {
            const candidate = body.replyTo.trim();
            // Basic email shape check; ignore anything that doesn't look valid
            if (/^[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+$/.test(candidate)) {
              replyTo = candidate.toLowerCase();
            }
          }
        } catch {
          return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }

        if (!templateName) {
          return Response.json({ error: "templateName is required" }, { status: 400 });
        }

        // 1. Look up template from registry (early — needed to resolve recipient)
        const template = TEMPLATES[templateName];

        if (!template) {
          console.error("Template not found in registry", { templateName });
          return Response.json(
            {
              error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
            },
            { status: 404 },
          );
        }

        // Resolve effective recipient: template-level `to` takes precedence over
        // the caller-provided recipientEmail. This allows notification templates
        // to always send to a fixed address (e.g., site owner from env var).
        const effectiveRecipient = template.to || recipientEmail;

        if (!effectiveRecipient) {
          return Response.json(
            {
              error: "recipientEmail is required (unless the template defines a fixed recipient)",
            },
            { status: 400 },
          );
        }

        // 2–5. Suppression check, token management, render, enqueue — delegated to helper.
        const sendResult = await sendTransactionalEmail({
          supabase,
          templateName,
          templateData,
          recipientEmail: recipientEmail || undefined,
          fromName,
          replyTo,
          idempotencyKey,
        });

        if (!sendResult.success) {
          if (sendResult.reason === "suppressed") {
            if (import.meta.env.DEV) {
              console.log("Email suppressed", {
                templateName,
                recipient_redacted: redactEmail(effectiveRecipient),
              });
            }
            return Response.json({ success: false, reason: "email_suppressed" });
          }
          if (sendResult.reason === "template_not_found") {
            return Response.json({ error: sendResult.error }, { status: 404 });
          }
          console.error("Failed to enqueue email", {
            templateName,
            recipient_redacted: redactEmail(effectiveRecipient),
          });
          return Response.json({ error: "Failed to enqueue email" }, { status: 500 });
        }

        if (import.meta.env.DEV) {
          console.log("Transactional email enqueued", {
            templateName,
            recipient_redacted: redactEmail(effectiveRecipient),
          });
        }

        return Response.json({ success: true, queued: true });
      },
    },
  },
});
