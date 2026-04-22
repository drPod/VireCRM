import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getConnector } from "@/lib/connectors/catalog";
import { callGateway } from "@/lib/connectors/gateway";
import { dispatchOutreachEmail } from "@/lib/email/dispatch-outreach";
import { sendSendgridEmail } from "@/lib/sendgrid";

type ConnectorProvider = "gmail" | "microsoft_outlook";

interface AvailableConnectorChannel {
  provider: ConnectorProvider;
  connectorId: string;
  envVar: string;
  fromAddress?: string | null;
}

export interface OutreachDeliveryChannels {
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
}

export type DeliverOutreachEmailResult =
  | { success: true; channel: "sendgrid" | "gmail" | "microsoft_outlook" | "lovable"; label: string }
  | { success: false; reason: string; suppressed?: boolean };

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

function buildGmailRawMessage(opts: {
  from?: string | null;
  to: string;
  subject: string;
  body: string;
  replyTo?: string | null;
}) {
  const lines = [
    opts.from ? `From: ${opts.from}` : null,
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : null,
    `To: ${opts.to}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    `Subject: ${opts.subject}`,
    "",
    opts.body,
  ].filter(Boolean) as string[];

  return Buffer.from(lines.join("\r\n"), "utf-8")
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

export async function loadOutreachDeliveryChannels(
  organizationId: string,
): Promise<OutreachDeliveryChannels> {
  const [sendgridResult, connectorResult] = await Promise.all([
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
  input: DeliverOutreachEmailInput,
): Promise<DeliverOutreachEmailResult> {
  const attemptedErrors: string[] = [];

  if (await isSuppressed(input.recipientEmail)) {
    return {
      success: false,
      suppressed: true,
      reason: "This recipient previously unsubscribed, bounced, or reported spam, so outreach was not sent.",
    };
  }

  if (input.channels.sendgrid) {
    try {
      await sendSendgridEmail({
        apiKey: input.channels.sendgrid.apiKey,
        from: input.channels.sendgrid.fromAddress,
        to: input.recipientEmail,
        subject: input.subject,
        html: plainTextToHtml(input.body),
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
          body: input.body,
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
            body: { contentType: "Text", content: input.body },
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