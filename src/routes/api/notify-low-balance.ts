/**
 * Authenticated trigger that checks an organization's credit balance and,
 * if it's below the configured threshold (and outside the 24h cooldown),
 * enqueues a low-balance alert email to every owner of the org.
 *
 * Usage from the client (after a balance change or on billing page load):
 *   POST /api/notify-low-balance  { "organizationId": "<uuid>" }
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { render } from "@react-email/components";
import { z } from "zod";
import { TEMPLATES } from "@/lib/email-templates/registry";

type AdminClient = SupabaseClient<any, any, any, any, any>;

const SENDER_DOMAIN = "notify.majix.ai";
const FROM_DOMAIN = "notify.majix.ai";
const FROM_DISPLAY_NAME = "VireCRM Billing";

const BodySchema = z.object({
  organizationId: z.string().uuid(),
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

export const Route = createFileRoute("/api/notify-low-balance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return jsonError("Server not configured", 500);
        }

        // 1. Verify caller's JWT.
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return jsonError("Unauthorized", 401);
        }
        const token = authHeader.slice("Bearer ".length).trim();
        const admin = createClient(supabaseUrl, serviceKey) as AdminClient;
        const { data: userRes, error: authErr } = await admin.auth.getUser(token);
        if (authErr || !userRes?.user) {
          return jsonError("Unauthorized", 401);
        }
        const callerId = userRes.user.id;

        // 2. Validate body.
        let parsed: z.infer<typeof BodySchema>;
        try {
          parsed = BodySchema.parse(await request.json());
        } catch (err) {
          const detail =
            err instanceof z.ZodError
              ? (err.issues[0]?.message ?? "Invalid request")
              : "Invalid request";
          return jsonError(detail, 400);
        }
        const { organizationId } = parsed;

        // 3. Caller must be an owner of this org.
        const { data: roleRow } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId)
          .eq("organization_id", organizationId)
          .eq("role", "owner")
          .maybeSingle();
        if (!roleRow) {
          return jsonError("Forbidden", 403);
        }

        // 4. Atomically decide whether to notify (also flips last_notified_at).
        const { data: decision, error: rpcErr } = await admin.rpc("check_and_mark_low_balance", {
          p_org_id: organizationId,
        });
        if (rpcErr) {
          console.error("notify-low-balance: RPC failed", rpcErr);
          return jsonError("Failed to evaluate balance", 500);
        }
        const result = decision as {
          should_notify: boolean;
          reason?: string;
          balance?: number;
          threshold?: number;
        };
        if (!result?.should_notify) {
          return Response.json({
            success: true,
            notified: false,
            reason: result?.reason ?? "unknown",
          });
        }

        const balance = result.balance ?? 0;
        const threshold = result.threshold ?? 0;

        // 5. Pull org context + auto-recharge state for the email body.
        const [{ data: org }, { data: settings }] = await Promise.all([
          admin.from("organizations").select("id, name").eq("id", organizationId).maybeSingle(),
          admin
            .from("org_credit_settings")
            .select("auto_recharge_enabled")
            .eq("organization_id", organizationId)
            .maybeSingle(),
        ]);

        // 6. Find every owner's email for this org.
        const { data: owners, error: ownersErr } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("organization_id", organizationId)
          .eq("role", "owner");
        if (ownersErr || !owners?.length) {
          console.error("notify-low-balance: no owners found", ownersErr);
          return jsonError("No owners to notify", 500);
        }

        const recipients: string[] = [];
        for (const row of owners) {
          const { data: u } = await admin.auth.admin.getUserById(row.user_id as string);
          const email = u?.user?.email;
          if (email) recipients.push(email.toLowerCase());
        }
        if (!recipients.length) {
          return jsonError("No owner emails resolved", 500);
        }

        // 7. Render template once.
        const tpl = TEMPLATES["credit-low-balance"];
        if (!tpl) return jsonError("Email template misconfigured", 500);

        const billingUrl = (() => {
          const origin = request.headers.get("origin");
          if (origin) return `${origin}/billing`;
          return "https://virecrm.com/billing";
        })();

        const templateData = {
          organizationName: org?.name ?? null,
          balance,
          threshold,
          billingUrl,
          autoRechargeEnabled: !!settings?.auto_recharge_enabled,
        };
        const element = React.createElement(tpl.component, templateData);
        const html = await render(element);
        const plainText = await render(element, { plainText: true });
        const subject = typeof tpl.subject === "function" ? tpl.subject(templateData) : tpl.subject;

        // 8. Enqueue per-recipient (skip suppressed).
        let queuedCount = 0;
        for (const recipient of recipients) {
          const { data: suppressed } = await admin
            .from("suppressed_emails")
            .select("id")
            .eq("email", recipient)
            .maybeSingle();
          if (suppressed) continue;

          // Reuse-or-create unsubscribe token (one per email).
          let unsubscribeToken: string;
          const { data: existingToken } = await admin
            .from("email_unsubscribe_tokens")
            .select("token, used_at")
            .eq("email", recipient)
            .maybeSingle();
          if (existingToken && !existingToken.used_at) {
            unsubscribeToken = existingToken.token as string;
          } else {
            unsubscribeToken = generateToken();
            await admin
              .from("email_unsubscribe_tokens")
              .upsert({ token: unsubscribeToken, email: recipient } as any, {
                onConflict: "email",
                ignoreDuplicates: true,
              });
            const { data: stored } = await admin
              .from("email_unsubscribe_tokens")
              .select("token")
              .eq("email", recipient)
              .maybeSingle();
            unsubscribeToken = (stored?.token as string) ?? unsubscribeToken;
          }

          const messageId = crypto.randomUUID();
          const idempotencyKey = `low-balance-${organizationId}-${Date.now()}-${recipient}`;

          await admin.from("email_send_log").insert({
            message_id: messageId,
            template_name: "credit-low-balance",
            recipient_email: recipient,
            status: "pending",
            metadata: {
              subject,
              organization_id: organizationId,
              balance,
              threshold,
            },
          } as any);

          const { error: enqueueErr } = await admin.rpc("enqueue_email", {
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
              label: "credit-low-balance",
              idempotency_key: idempotencyKey,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          } as any);

          if (enqueueErr) {
            console.error("notify-low-balance: enqueue failed", enqueueErr);
            await admin.from("email_send_log").insert({
              message_id: messageId,
              template_name: "credit-low-balance",
              recipient_email: recipient,
              status: "failed",
              error_message: "Failed to enqueue low balance email",
            } as any);
            continue;
          }
          queuedCount++;
        }

        return Response.json({
          success: true,
          notified: true,
          balance,
          threshold,
          queued: queuedCount,
        });
      },
    },
  },
});
