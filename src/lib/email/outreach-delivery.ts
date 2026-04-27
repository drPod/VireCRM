import { render } from "@react-email/render";
import { createElement } from "react";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getConnector } from "@/lib/connectors/catalog";
import { callGateway } from "@/lib/connectors/gateway";
import { dispatchOutreachEmail } from "@/lib/email/dispatch-outreach";
import { template as outreachTemplate } from "@/lib/email-templates/outreach-email";
import { sendResendEmail } from "@/lib/resend";
import { sendSendgridEmail } from "@/lib/sendgrid";

// Genesis platform defaults — used when an org hasn't configured its own
// brand assets. Replies are routed to the business inbox so leads can hit
// "reply" and reach a real person.
const GENESIS_DEFAULT_REPLY_TO = "Genesis@genesisx.space";
const GENESIS_DEFAULT_LOGO_URL = "https://genesisx.space/genesis-logo.png";

type ConnectorProvider = "gmail" | "microsoft_outlook";

interface AvailableConnectorChannel {
  provider: ConnectorProvider;
  connectorId: string;
  envVar: string;
  fromAddress?: string | null;
}

export interface OutreachDeliveryChannels {
  /**
   * Resend connection details for this org. Present only when:
   *   1. The Resend connector is linked at the workspace level
   *      (`process.env.RESEND_API_KEY` exists), AND
   *   2. The org owner saved a verified `fromAddress` for Resend.
   *
   * Resend takes priority over SendGrid because it's the more recently-added
   * channel and users opting into it have explicitly set a from address.
   */
  resend?: {
    fromAddress: string;
    replyTo?: string | null;
  };
  sendgrid?: {
    apiKey: string;
    fromAddress: string;
  };
  connectors: AvailableConnectorChannel[];
}

export interface DeliverOutreachEmailInput {
  recipientEmail: string;
  subject: string;
  body: string;
  brandName: string;
  replyTo?: string | null;
  idempotencyKey: string;
  channels: OutreachDeliveryChannels;
  /** Optional brand logo URL shown in the email header. */
  logoUrl?: string | null;
  /** Optional brand accent color (hex) for the email divider. */
  accentColor?: string | null;
  /** Optional brand font name (Google Font) for the email body. */
  fontFamily?: string | null;
  /** Optional plain-text signature appended below the sign-off. */
  signature?: string | null;
  /**
   * Organization ID for credit enforcement. When provided, this function
   * will refuse to send if the org has exhausted its monthly credit quota
   * (unless `unlimited_credits` is enabled). Strongly recommended — leaving
   * this unset bypasses the hard-stop and should only be used for system
   * mail (auth emails, internal notifications) that doesn't bill credits.
   */
  organizationId?: string;
}

export type DeliverOutreachEmailResult =
  | {
      success: true;
      channel: "resend" | "sendgrid" | "gmail" | "microsoft_outlook" | "lovable";
      label: string;
    }
  | { success: false; reason: string; suppressed?: boolean; creditsExhausted?: boolean };

const EMAIL_PROVIDER_PRIORITY: ConnectorProvider[] = ["gmail", "microsoft_outlook"];

function plainTextToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

/**
 * Render the branded React Email outreach template to HTML so every external
 * channel (Resend, SendGrid, Gmail, Outlook) sends the same polished, logo'd
 * email instead of a raw plain-text wrapper.
 */
async function renderBrandedHtml(input: DeliverOutreachEmailInput): Promise<string> {
  try {
    const element = createElement(outreachTemplate.component, {
      body: input.body,
      brandName: input.brandName,
      logoUrl: input.logoUrl ?? undefined,
      accentColor: input.accentColor ?? undefined,
      fontFamily: input.fontFamily ?? undefined,
      signature: input.signature ?? undefined,
    });
    return await render(element, { pretty: false });
  } catch {
    // Never block a send on a render failure — fall back to a basic wrapper.
    return plainTextToHtml(input.body);
  }
}

function encodeHeader(value: string): string {
  // Use MIME encoded-word for any non-ASCII subjects.
  return /[^\x20-\x7E]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`
    : value;
}

function buildGmailRawMessage(opts: {
  from?: string | null;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
}) {
  const boundary = `=_lov_${Math.random().toString(36).slice(2)}`;
  const headerLines = [
    opts.from ? `From: ${opts.from}` : null,
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : null,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean) as string[];

  const body = [
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.html,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return Buffer.from(headerLines.join("\r\n") + body, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function toSafeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+$/.test(trimmed)
    ? trimmed.toLowerCase()
    : null;
}

function toSafeLogoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Only accept https URLs — email clients block http and protocol-relative.
  return /^https:\/\/[^\s<>"']+$/i.test(trimmed) ? trimmed : null;
}

export async function loadOutreachDeliveryChannels(
  organizationId: string,
): Promise<OutreachDeliveryChannels> {
  const [resendResult, sendgridResult, connectorResult] = await Promise.all([
    supabaseAdmin
      .from("org_integrations")
      .select("config")
      .eq("organization_id", organizationId)
      .eq("provider", "resend")
      .maybeSingle(),
    supabaseAdmin
      .from("org_integrations")
      .select("api_key, config")
      .eq("organization_id", organizationId)
      .eq("provider", "sendgrid")
      .maybeSingle(),
    supabaseAdmin
      .from("org_connectors")
      .select("provider, config")
      .eq("organization_id", organizationId)
      .eq("enabled", true)
      .in("provider", EMAIL_PROVIDER_PRIORITY),
  ]);

  const channels: OutreachDeliveryChannels = { connectors: [] };

  // Resend — workspace-level connector + per-org from address.
  // Only enable if the connector is actually linked (env var present);
  // otherwise we'd attempt sends that always fail.
  const resendConfig = (resendResult.data?.config ?? {}) as Record<string, unknown>;
  const resendFrom = toSafeEmail(resendConfig.fromAddress);
  if (resendFrom && process.env.RESEND_API_KEY) {
    channels.resend = {
      fromAddress: resendFrom,
      replyTo: toSafeEmail(resendConfig.replyTo),
    };
  }

  const sendgridConfig = (sendgridResult.data?.config ?? {}) as Record<string, unknown>;
  const sendgridFrom =
    toSafeEmail(sendgridConfig.defaultFromAddress) ?? toSafeEmail(sendgridConfig.fromAddress);

  if (sendgridResult.data?.api_key && sendgridFrom) {
    channels.sendgrid = {
      apiKey: sendgridResult.data.api_key,
      fromAddress: sendgridFrom,
    };
  }

  const rows = connectorResult.data ?? [];
  for (const provider of EMAIL_PROVIDER_PRIORITY) {
    const row = rows.find((entry) => entry.provider === provider);
    if (!row) continue;
    const meta = getConnector(provider);
    if (!meta || !process.env[meta.envVar]) continue;
    const cfg = (row.config ?? {}) as Record<string, unknown>;
    channels.connectors.push({
      provider,
      connectorId: meta.connectorId,
      envVar: meta.envVar,
      fromAddress: toSafeEmail(cfg.fromAddress) ?? toSafeEmail(cfg.connectedEmail),
    });
  }

  return channels;
}

async function isSuppressed(email: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) {
    throw new Error("Could not verify whether this recipient can receive outreach right now.");
  }

  return !!data;
}

export async function deliverOutreachEmail(
  rawInput: DeliverOutreachEmailInput,
): Promise<DeliverOutreachEmailResult> {
  // Normalize: if the org didn't set a logo or reply-to, fall back to the
  // Genesis brand defaults so every outreach email arrives with a logo in
  // the header and a real business inbox the recipient can reply to.
  const input: DeliverOutreachEmailInput = {
    ...rawInput,
    logoUrl: toSafeLogoUrl(rawInput.logoUrl) ?? GENESIS_DEFAULT_LOGO_URL,
    replyTo: toSafeEmail(rawInput.replyTo) ?? GENESIS_DEFAULT_REPLY_TO,
  };

  const attemptedErrors: string[] = [];

  // Hard stop: refuse to send when the org has exhausted its monthly credit
  // quota. Ownership / Custom CRM tiers (`unlimited_credits = true`) bypass
  // this entirely. Callers still consume the credit explicitly via the
  // `consume_credit` RPC; this is defense-in-depth in case a future call
  // path forgets to pre-check.
  if (input.organizationId) {
    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .select("monthly_credit_quota, credits_used_this_period, unlimited_credits, credit_period_start")
      .eq("id", input.organizationId)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        reason: "Could not verify your credit balance before sending.",
      };
    }

    if (org && !org.unlimited_credits) {
      // Treat a rolled-over period as zero used; the next consume_credit RPC
      // will persist the reset.
      const periodStart = org.credit_period_start ? new Date(org.credit_period_start) : null;
      const currentMonth = new Date();
      currentMonth.setUTCDate(1);
      currentMonth.setUTCHours(0, 0, 0, 0);
      const used =
        periodStart && periodStart < currentMonth
          ? 0
          : org.credits_used_this_period ?? 0;
      const quota = org.monthly_credit_quota ?? 0;

      if (used >= quota) {
        return {
          success: false,
          creditsExhausted: true,
          reason:
            "You've used all your monthly credits. Upgrade your plan or wait for the next billing period to send more outreach.",
        };
      }
    }
  }

  if (await isSuppressed(input.recipientEmail)) {
    return {
      success: false,
      suppressed: true,
      reason: "This recipient previously unsubscribed, bounced, or reported spam, so outreach was not sent.",
    };
  }

  // Render the branded React Email template once and reuse for every external
  // channel so emails always include the org's logo, brand color, font, and
  // signature — not raw plain-text wrapped in <p> tags.
  const brandedHtml = await renderBrandedHtml(input);

  // Resend goes first — it's the most recently-wired channel and users who
  // configured it explicitly opted into it for outreach.
  if (input.channels.resend) {
    try {
      const result = await sendResendEmail({
        from: input.channels.resend.fromAddress,
        to: input.recipientEmail,
        subject: input.subject,
        html: brandedHtml,
        replyTo:
          toSafeEmail(input.replyTo) ??
          toSafeEmail(input.channels.resend.replyTo) ??
          undefined,
      });
      await supabaseAdmin.from("email_send_log").insert({
        recipient_email: input.recipientEmail,
        template_name: "outreach_resend",
        status: "sent",
        message_id: result.messageId,
        metadata: {
          channel: "resend",
          from: input.channels.resend.fromAddress,
          idempotency_key: input.idempotencyKey,
        } as never,
      });
      return { success: true, channel: "resend", label: "Resend" };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "send failed";
      attemptedErrors.push(`Resend: ${reason}`);
      await supabaseAdmin.from("email_send_log").insert({
        recipient_email: input.recipientEmail,
        template_name: "outreach_resend",
        status: "failed",
        error_message: reason,
        metadata: {
          channel: "resend",
          from: input.channels.resend.fromAddress,
          idempotency_key: input.idempotencyKey,
        } as never,
      });
    }
  }

  if (input.channels.sendgrid) {
    try {
      await sendSendgridEmail({
        apiKey: input.channels.sendgrid.apiKey,
        from: input.channels.sendgrid.fromAddress,
        to: input.recipientEmail,
        subject: input.subject,
        html: brandedHtml,
        replyTo: toSafeEmail(input.replyTo) ?? undefined,
      });
      return { success: true, channel: "sendgrid", label: "SendGrid" };
    } catch (error) {
      attemptedErrors.push(`SendGrid: ${error instanceof Error ? error.message : "send failed"}`);
    }
  }

  for (const connector of input.channels.connectors) {
    try {
      if (connector.provider === "gmail") {
        const raw = buildGmailRawMessage({
          from: connector.fromAddress,
          to: input.recipientEmail,
          subject: input.subject,
          text: input.body,
          html: brandedHtml,
          replyTo: input.replyTo,
        });

        await callGateway({
          connectorId: connector.connectorId,
          envVar: connector.envVar,
          path: "/gmail/v1/users/me/messages/send",
          body: { raw },
        });

        return { success: true, channel: "gmail", label: "Gmail" };
      }

      await callGateway({
        connectorId: connector.connectorId,
        envVar: connector.envVar,
        path: "/me/sendMail",
        body: {
          message: {
            subject: input.subject,
            body: { contentType: "HTML", content: brandedHtml },
            toRecipients: [{ emailAddress: { address: input.recipientEmail } }],
            ...(toSafeEmail(input.replyTo)
              ? {
                  replyTo: [{ emailAddress: { address: toSafeEmail(input.replyTo) } }],
                }
              : {}),
          },
          saveToSentItems: true,
        },
      });

      return { success: true, channel: "microsoft_outlook", label: "Microsoft Outlook" };
    } catch (error) {
      const label = connector.provider === "gmail" ? "Gmail" : "Outlook";
      attemptedErrors.push(`${label}: ${error instanceof Error ? error.message : "send failed"}`);
    }
  }

  const fallback = await dispatchOutreachEmail({
    templateName: "outreach-email",
    recipientEmail: input.recipientEmail,
    idempotencyKey: input.idempotencyKey,
    templateData: {
      subject: input.subject,
      body: input.body,
      brandName: input.brandName,
      logoUrl: input.logoUrl ?? undefined,
      accentColor: input.accentColor ?? undefined,
      fontFamily: input.fontFamily ?? undefined,
      signature: input.signature ?? undefined,
    },
    fromName: input.brandName,
    replyTo: input.replyTo,
  });

  if (fallback.success) {
    return { success: true, channel: "lovable", label: "built-in email" };
  }

  if (fallback.reason === "suppressed") {
    return {
      success: false,
      suppressed: true,
      reason: "This recipient previously unsubscribed, bounced, or reported spam, so outreach was not sent.",
    };
  }

  const summary = attemptedErrors.length
    ? `Connected email channels were unavailable (${attemptedErrors[0]}).`
    : "No connected email channel accepted the message.";

  return {
    success: false,
    reason: `${summary} The draft was saved, so you can retry after reconnecting Gmail, Outlook, SendGrid, or the built-in mail channel.`,
  };
}