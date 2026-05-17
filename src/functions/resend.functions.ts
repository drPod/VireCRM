/**
 * Resend integration server functions — owner-only.
 *
 * Resend is platform-managed (single `RESEND_API_KEY` env var on the worker),
 * so there's no per-org API key. We persist a row in `org_integrations` with
 * provider = 'resend' purely to keep per-org settings (`fromAddress`,
 * `replyTo`) and a `last_verified_at` timestamp consistent with the rest of
 * the integrations surface. The `api_key` column gets a sentinel value since
 * the real key lives in `process.env.RESEND_API_KEY`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendResendEmail, verifyResendConnection } from "@/lib/resend";

const PROVIDER = "resend" as const;
// Stored in `api_key` to satisfy NOT NULL while signalling "managed by
// platform, not a per-org secret". Previously read as `__lovable_connector__`;
// kept the column unchanged so any existing rows continue to work.
const KEY_SENTINEL = "__platform_managed__";

async function assertOwner(userId: string, organizationId: string) {
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .maybeSingle();
  if (!roleRow) throw new Error("Only the organization owner can manage Resend.");
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ResendConfig {
  fromAddress?: string | null;
  replyTo?: string | null;
}

function readConfig(raw: unknown): ResendConfig {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  return {
    fromAddress: typeof r.fromAddress === "string" ? r.fromAddress : null,
    replyTo: typeof r.replyTo === "string" ? r.replyTo : null,
  };
}

// ----- GET status -----
const getSchema = z.object({ organizationId: z.string().uuid() });

export const getResendStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof getSchema>) => getSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.organizationId);

    const connectorAvailable = !!process.env.RESEND_API_KEY;

    const { data: row } = await supabaseAdmin
      .from("org_integrations")
      .select("config, last_verified_at, updated_at")
      .eq("organization_id", data.organizationId)
      .eq("provider", PROVIDER)
      .maybeSingle();

    const config = readConfig(row?.config);
    return {
      connectorAvailable,
      configured: !!row,
      fromAddress: config.fromAddress ?? "",
      replyTo: config.replyTo ?? "",
      lastVerifiedAt: row?.last_verified_at ?? null,
      updatedAt: row?.updated_at ?? null,
    };
  });

// ----- SAVE settings (from address / reply-to) -----
const saveSchema = z.object({
  organizationId: z.string().uuid(),
  fromAddress: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || emailRegex.test(v), {
      message: "Send-from must be a valid email address.",
    }),
  replyTo: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || emailRegex.test(v), {
      message: "Reply-to must be a valid email address.",
    }),
});

export const saveResendSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof saveSchema>) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.organizationId);

    if (!process.env.RESEND_API_KEY) {
      throw new Error(
        "Resend isn't connected on this workspace yet. Connect Resend before saving send settings.",
      );
    }

    const config: ResendConfig = {
      fromAddress: data.fromAddress.trim() || null,
      replyTo: data.replyTo.trim() || null,
    };

    const { error } = await supabaseAdmin.from("org_integrations").upsert(
      {
        organization_id: data.organizationId,
        provider: PROVIDER,
        api_key: KEY_SENTINEL,
        config: config as never,
      },
      { onConflict: "organization_id,provider" },
    );

    if (error) throw new Error(`Failed to save Resend settings: ${error.message}`);
    return { success: true };
  });

// ----- TEST connection (verify credentials, no send) -----
const testSchema = z.object({ organizationId: z.string().uuid() });

export const testResendConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof testSchema>) => testSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.organizationId);

    const verify = await verifyResendConnection();
    if (!verify.ok) {
      return { ok: false as const, reason: verify.reason };
    }

    await supabaseAdmin
      .from("org_integrations")
      .update({ last_verified_at: new Date().toISOString() })
      .eq("organization_id", data.organizationId)
      .eq("provider", PROVIDER);

    return { ok: true as const, verifiedAt: new Date().toISOString() };
  });

// ----- DISCONNECT (clear the per-org config; the workspace connection stays) -----
const disconnectSchema = z.object({ organizationId: z.string().uuid() });

export const disconnectResendFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof disconnectSchema>) => disconnectSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.organizationId);

    const { error } = await supabaseAdmin
      .from("org_integrations")
      .delete()
      .eq("organization_id", data.organizationId)
      .eq("provider", PROVIDER);

    if (error) throw new Error(`Failed to disconnect Resend: ${error.message}`);
    return { success: true };
  });

// ----- SEND TEST email (uses saved fromAddress/replyTo) -----
const testSendSchema = z.object({
  organizationId: z.string().uuid(),
  to: z.string().email().max(254),
});

export const sendResendTestEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof testSendSchema>) => testSendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.organizationId);

    const { data: row } = await supabaseAdmin
      .from("org_integrations")
      .select("config")
      .eq("organization_id", data.organizationId)
      .eq("provider", PROVIDER)
      .maybeSingle();

    const config = readConfig(row?.config);
    if (!config.fromAddress) {
      return {
        ok: false as const,
        reason: "Set a Send-from address in the Resend card before sending a test.",
      };
    }

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("brand_name, name")
      .eq("id", data.organizationId)
      .maybeSingle();
    const brandName = org?.brand_name || org?.name || "your CRM";

    const subject = `Resend test from ${brandName}`;
    const html =
      `<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">` +
      `<h2 style="margin:0 0 12px;font-size:18px">Resend is working ✅</h2>` +
      `<p style="margin:0 0 12px;line-height:1.5">` +
      `This test email was sent through your platform-managed Resend integration. ` +
      `If you received it, outreach sends from <strong>${brandName}</strong> are wired up correctly.` +
      `</p>` +
      `<p style="margin:0;color:#666;font-size:12px">You can safely ignore or delete this message.</p>` +
      `</div>`;

    try {
      const result = await sendResendEmail({
        from: config.fromAddress,
        to: data.to,
        subject,
        html,
        replyTo: config.replyTo ?? undefined,
      });

      // Audit trail — same table the rest of the email pipeline writes to.
      await supabaseAdmin.from("email_send_log").insert({
        recipient_email: data.to,
        template_name: "outreach_resend_test",
        status: "sent",
        message_id: result.messageId,
        metadata: {
          organization_id: data.organizationId,
          channel: "resend",
          from: config.fromAddress,
        } as never,
      });

      return { ok: true as const, messageId: result.messageId };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      await supabaseAdmin.from("email_send_log").insert({
        recipient_email: data.to,
        template_name: "outreach_resend_test",
        status: "failed",
        error_message: reason,
        metadata: {
          organization_id: data.organizationId,
          channel: "resend",
          from: config.fromAddress,
        } as never,
      });
      return { ok: false as const, reason };
    }
  });
