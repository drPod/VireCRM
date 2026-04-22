/**
 * Outbound action server functions for connector-based integrations.
 *
 * Each handler:
 *   1. Confirms the caller belongs to the org.
 *   2. Confirms the connector is enabled + the gateway env var is present.
 *   3. Calls the gateway via callGateway(...).
 *   4. Records the result in connector_activity_log (best-effort).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGateway } from "@/lib/connectors/gateway";
import { getConnector } from "@/lib/connectors/catalog";
import { sendSendgridEmail } from "@/lib/sendgrid";
import { recordConnectorActivity } from "./_connector-log";
import { z } from "zod";

/**
 * Best-effort: persist a sent email to the `messages` table so it shows up in
 * the lead drawer Activity feed, and bump the lead to "contacted" if it was
 * still "new". Mirrors what sendOutreachWithContentFn does for the AI path.
 */
async function logLeadEmail(input: {
  organizationId: string;
  leadId: string | null | undefined;
  subject: string;
  body: string;
  provider: string;
}) {
  if (!input.leadId) return;
  try {
    await supabaseAdmin.from("messages").insert({
      organization_id: input.organizationId,
      lead_id: input.leadId,
      subject: input.subject,
      content: input.body,
      type: "email",
      status: "sent",
    });
    await supabaseAdmin
      .from("leads")
      .update({ status: "contacted", last_contact: new Date().toISOString() })
      .eq("id", input.leadId)
      .eq("status", "new");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[${input.provider}] message log insert failed`, err);
  }
}

async function assertMemberAndConnector(
  userId: string,
  organizationId: string,
  provider: string,
) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.organization_id !== organizationId) {
    throw new Error("Not a member of that organization.");
  }

  const meta = getConnector(provider);
  if (!meta) throw new Error(`Unknown connector: ${provider}`);

  const { data: row } = await supabaseAdmin
    .from("org_connectors")
    .select("enabled, config")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle();

  if (!row?.enabled) {
    throw new Error(`${meta.name} is not enabled. Enable it in Settings → Integrations.`);
  }
  if (!process.env[meta.envVar]) {
    throw new Error(
      `${meta.name} credentials are missing. Reconnect it in Settings → Integrations.`,
    );
  }

  return { meta, config: (row.config as Record<string, unknown>) ?? {} };
}

// ===== Slack: post a message to a channel =====
const slackSchema = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  channel: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(4000),
});

export const sendSlackMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof slackSchema>) => slackSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { meta } = await assertMemberAndConnector(context.userId, data.organizationId, "slack");

    try {
      const result = await callGateway<{ ok: boolean; error?: string; ts?: string }>({
        connectorId: meta.connectorId,
        envVar: meta.envVar,
        path: "/api/chat.postMessage",
        body: { channel: data.channel, text: data.text },
      });

      if (!result.ok) {
        throw new Error(`Slack rejected the message: ${result.error ?? "unknown"}`);
      }

      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "slack",
        direction: "outbound",
        action: "send_message",
        summary: `Sent to #${data.channel.replace(/^#/, "")}`,
        payload: { ts: result.ts, channel: data.channel },
      });

      return { ok: true, ts: result.ts ?? null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "slack",
        direction: "outbound",
        action: "send_message",
        status: "failed",
        errorMessage: msg,
        payload: { channel: data.channel },
      });
      throw err;
    }
  });

// ===== Microsoft Teams: post a message to a channel =====
const teamsSchema = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  teamId: z.string().trim().min(1),
  channelId: z.string().trim().min(1),
  text: z.string().trim().min(1).max(4000),
});

export const sendTeamsMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof teamsSchema>) => teamsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { meta } = await assertMemberAndConnector(
      context.userId,
      data.organizationId,
      "microsoft_teams",
    );

    try {
      await callGateway({
        connectorId: meta.connectorId,
        envVar: meta.envVar,
        path: `/teams/${encodeURIComponent(data.teamId)}/channels/${encodeURIComponent(data.channelId)}/messages`,
        body: { body: { contentType: "text", content: data.text } },
      });

      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "microsoft_teams",
        direction: "outbound",
        action: "send_message",
        summary: `Sent to Teams channel`,
        payload: { teamId: data.teamId, channelId: data.channelId },
      });

      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "microsoft_teams",
        direction: "outbound",
        action: "send_message",
        status: "failed",
        errorMessage: msg,
        payload: {},
      });
      throw err;
    }
  });

// ===== Twilio: send SMS =====
const smsSchema = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  fromNumber: z.string().trim().min(5).max(20),
  toNumber: z.string().trim().min(5).max(20),
  body: z.string().trim().min(1).max(1600),
});

export const sendTwilioSmsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof smsSchema>) => smsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { meta, config } = await assertMemberAndConnector(
      context.userId,
      data.organizationId,
      "twilio",
    );

    const accountSid = (config.accountSid as string | undefined) ?? "";
    if (!accountSid) {
      throw new Error("Twilio Account SID missing. Set it in Settings → Integrations → Twilio.");
    }

    try {
      const result = await callGateway<{ sid?: string; status?: string; error_message?: string }>({
        connectorId: meta.connectorId,
        envVar: meta.envVar,
        path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
        formBody: { From: data.fromNumber, To: data.toNumber, Body: data.body },
      });

      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "twilio",
        direction: "outbound",
        action: "send_sms",
        summary: `SMS sent to ${data.toNumber}`,
        payload: { sid: result.sid, status: result.status },
      });

      return { ok: true, sid: result.sid ?? null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "twilio",
        direction: "outbound",
        action: "send_sms",
        status: "failed",
        errorMessage: msg,
        payload: { to: data.toNumber },
      });
      throw err;
    }
  });

// ===== Outlook: send mail =====
const outlookSchema = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  to: z.string().trim().email(),
  subject: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(50_000),
});

export const sendOutlookEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof outlookSchema>) => outlookSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { meta } = await assertMemberAndConnector(
      context.userId,
      data.organizationId,
      "microsoft_outlook",
    );

    try {
      await callGateway({
        connectorId: meta.connectorId,
        envVar: meta.envVar,
        path: "/me/sendMail",
        body: {
          message: {
            subject: data.subject,
            body: { contentType: "Text", content: data.body },
            toRecipients: [{ emailAddress: { address: data.to } }],
          },
          saveToSentItems: true,
        },
      });

      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "microsoft_outlook",
        direction: "outbound",
        action: "send_email",
        summary: `Email sent to ${data.to}`,
        payload: { subject: data.subject },
      });

      await logLeadEmail({
        organizationId: data.organizationId,
        leadId: data.leadId,
        subject: data.subject,
        body: data.body,
        provider: "microsoft_outlook",
      });

      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "microsoft_outlook",
        direction: "outbound",
        action: "send_email",
        status: "failed",
        errorMessage: msg,
        payload: { to: data.to },
      });
      throw err;
    }
  });

// ===== Linear: create an issue from a lead =====
const linearSchema = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  teamId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(50_000).optional(),
});

export const createLinearIssueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof linearSchema>) => linearSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { meta } = await assertMemberAndConnector(context.userId, data.organizationId, "linear");

    const mutation = `mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { id identifier url } }
    }`;

    try {
      const result = await callGateway<{
        data?: { issueCreate?: { success?: boolean; issue?: { id: string; identifier: string; url: string } } };
        errors?: Array<{ message: string }>;
      }>({
        connectorId: meta.connectorId,
        envVar: meta.envVar,
        path: "/graphql",
        body: {
          query: mutation,
          variables: {
            input: { teamId: data.teamId, title: data.title, description: data.description ?? "" },
          },
        },
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((e) => e.message).join("; "));
      }
      const issue = result.data?.issueCreate?.issue;

      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "linear",
        direction: "outbound",
        action: "create_task",
        summary: `Created Linear issue ${issue?.identifier ?? ""}`.trim(),
        payload: { id: issue?.id, identifier: issue?.identifier, url: issue?.url },
      });

      return { ok: true, issue: issue ?? null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "linear",
        direction: "outbound",
        action: "create_task",
        status: "failed",
        errorMessage: msg,
        payload: { teamId: data.teamId },
      });
      throw err;
    }
  });

// ===== HubSpot: import contacts as leads =====
const hubspotSchema = z.object({
  organizationId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(25),
});

export const importHubspotContactsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof hubspotSchema>) => hubspotSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { meta } = await assertMemberAndConnector(context.userId, data.organizationId, "hubspot");

    try {
      const result = await callGateway<{
        results?: Array<{
          id: string;
          properties: Record<string, string | null | undefined>;
        }>;
      }>({
        connectorId: meta.connectorId,
        envVar: meta.envVar,
        path: `/crm/v3/objects/contacts?limit=${data.limit}&properties=email,firstname,lastname,phone,company,jobtitle`,
        method: "GET",
      });

      const contacts = result.results ?? [];
      let inserted = 0;
      let skipped = 0;

      for (const c of contacts) {
        const p = c.properties ?? {};
        const fullName = [p.firstname, p.lastname].filter(Boolean).join(" ").trim()
          || p.email
          || `HubSpot contact ${c.id}`;

        if (!p.email) {
          skipped++;
          continue;
        }

        // Avoid duplicates by email within this org
        const { data: existing } = await supabaseAdmin
          .from("leads")
          .select("id")
          .eq("organization_id", data.organizationId)
          .eq("email", p.email)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const { error } = await supabaseAdmin.from("leads").insert({
          organization_id: data.organizationId,
          name: fullName,
          email: p.email,
          phone: p.phone ?? null,
          company: p.company ?? null,
          status: "new",
          source: "hubspot",
        });
        if (error) {
          skipped++;
          continue;
        }
        inserted++;
      }

      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        provider: "hubspot",
        direction: "inbound",
        action: "sync_contacts",
        summary: `Imported ${inserted} contact${inserted === 1 ? "" : "s"} (${skipped} skipped)`,
        payload: { fetched: contacts.length, inserted, skipped },
      });

      return { ok: true, fetched: contacts.length, inserted, skipped };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        provider: "hubspot",
        direction: "inbound",
        action: "sync_contacts",
        status: "failed",
        errorMessage: msg,
        payload: {},
      });
      throw err;
    }
  });

// ===== Gmail: send mail via the Gmail API (gateway) =====
const gmailSchema = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  to: z.string().trim().email(),
  subject: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(50_000),
  fromAddress: z.string().trim().email().optional(),
});

/**
 * Build an RFC 2822 email then base64url-encode it the way Gmail's
 * users.messages.send endpoint expects.
 */
function buildGmailRawMessage(opts: { from?: string; to: string; subject: string; body: string }) {
  const lines = [
    opts.from ? `From: ${opts.from}` : null,
    `To: ${opts.to}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    `Subject: ${opts.subject}`,
    "",
    opts.body,
  ].filter(Boolean) as string[];
  const raw = lines.join("\r\n");
  // base64url (no padding) of UTF-8 bytes
  return Buffer.from(raw, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export const sendGmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof gmailSchema>) => gmailSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { meta, config } = await assertMemberAndConnector(
      context.userId,
      data.organizationId,
      "gmail",
    );

    const fromAddress =
      data.fromAddress ?? (typeof config.fromAddress === "string" ? config.fromAddress : undefined);

    try {
      const raw = buildGmailRawMessage({
        from: fromAddress,
        to: data.to,
        subject: data.subject,
        body: data.body,
      });

      const result = await callGateway<{ id?: string; threadId?: string }>({
        connectorId: meta.connectorId,
        envVar: meta.envVar,
        path: "/gmail/v1/users/me/messages/send",
        body: { raw },
      });

      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "gmail",
        direction: "outbound",
        action: "send_email",
        summary: `Email sent to ${data.to}`,
        payload: { subject: data.subject, gmailId: result.id, threadId: result.threadId },
      });

      await logLeadEmail({
        organizationId: data.organizationId,
        leadId: data.leadId,
        subject: data.subject,
        body: data.body,
        provider: "gmail",
      });

      return { ok: true, id: result.id ?? null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "gmail",
        direction: "outbound",
        action: "send_email",
        status: "failed",
        errorMessage: msg,
        payload: { to: data.to },
      });
      throw err;
    }
  });

// ===== SendGrid: send mail using the org's BYO API key =====
const sendgridSchema = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  to: z.string().trim().email(),
  subject: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(50_000),
  fromAddress: z.string().trim().email().optional(),
});

/** Convert a plain-text body to minimal HTML so SendGrid renders line breaks. */
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

export const sendSendgridLeadEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof sendgridSchema>) => sendgridSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Membership check
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profile?.organization_id !== data.organizationId) {
      throw new Error("Not a member of that organization.");
    }

    const { data: row } = await supabaseAdmin
      .from("org_integrations")
      .select("api_key, config")
      .eq("organization_id", data.organizationId)
      .eq("provider", "sendgrid")
      .maybeSingle();

    if (!row?.api_key) {
      throw new Error("SendGrid is not configured. Add an API key in Settings → Integrations.");
    }

    const cfg = (row.config as Record<string, unknown> | null) ?? {};
    const fromAddress =
      data.fromAddress ??
      (typeof cfg.defaultFromAddress === "string" ? cfg.defaultFromAddress : undefined) ??
      (typeof cfg.fromAddress === "string" ? cfg.fromAddress : undefined);

    if (!fromAddress) {
      throw new Error(
        "No SendGrid 'from' address configured. Set a default from address in Settings → Integrations → SendGrid.",
      );
    }

    try {
      const result = await sendSendgridEmail({
        apiKey: row.api_key,
        from: fromAddress,
        to: data.to,
        subject: data.subject,
        html: plainTextToHtml(data.body),
      });

      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "sendgrid",
        direction: "outbound",
        action: "send_email",
        summary: `Email sent to ${data.to}`,
        payload: { subject: data.subject, messageId: result.messageId, from: fromAddress },
      });

      await logLeadEmail({
        organizationId: data.organizationId,
        leadId: data.leadId,
        subject: data.subject,
        body: data.body,
        provider: "sendgrid",
      });

      return { ok: true, messageId: result.messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: data.leadId ?? null,
        provider: "sendgrid",
        direction: "outbound",
        action: "send_email",
        status: "failed",
        errorMessage: msg,
        payload: { to: data.to },
      });
      throw err;
    }
  });

// ===== List which email providers are usable for sending from this lead =====
const listEmailProvidersSchema = z.object({ organizationId: z.string().uuid() });

export interface LeadEmailProvider {
  /** "gmail" | "microsoft_outlook" | "sendgrid" */
  provider: string;
  /** Friendly label for the picker. */
  label: string;
  /** Pre-filled "from" address if one is configured. */
  defaultFromAddress: string | null;
}

export const listLeadEmailProvidersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof listEmailProvidersSchema>) =>
    listEmailProvidersSchema.parse(input),
  )
  .handler(async ({ data, context }): Promise<{ providers: LeadEmailProvider[] }> => {
    // Membership check
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profile?.organization_id !== data.organizationId) {
      throw new Error("Not a member of that organization.");
    }

    const providers: LeadEmailProvider[] = [];

    // Connector-based providers (Gmail / Outlook)
    const { data: connectorRows } = await supabaseAdmin
      .from("org_connectors")
      .select("provider, config")
      .eq("organization_id", data.organizationId)
      .eq("enabled", true)
      .in("provider", ["gmail", "microsoft_outlook"]);

    for (const r of connectorRows ?? []) {
      const meta = getConnector(r.provider);
      if (!meta) continue;
      if (!process.env[meta.envVar]) continue; // not actually linked yet
      const cfg = (r.config as Record<string, unknown> | null) ?? {};
      providers.push({
        provider: r.provider,
        label: meta.name,
        defaultFromAddress: typeof cfg.fromAddress === "string" ? cfg.fromAddress : null,
      });
    }

    // BYO-key SendGrid
    const { data: sgRow } = await supabaseAdmin
      .from("org_integrations")
      .select("api_key, config")
      .eq("organization_id", data.organizationId)
      .eq("provider", "sendgrid")
      .maybeSingle();

    if (sgRow?.api_key) {
      const cfg = (sgRow.config as Record<string, unknown> | null) ?? {};
      const from =
        (typeof cfg.defaultFromAddress === "string" ? cfg.defaultFromAddress : null) ??
        (typeof cfg.fromAddress === "string" ? cfg.fromAddress : null);
      providers.push({
        provider: "sendgrid",
        label: "SendGrid",
        defaultFromAddress: from,
      });
    }

    return { providers };
  });

// ===== Send a test email (Gmail or SendGrid) — used by Settings → Integrations =====
//
// This validates that the integration is fully configured (enabled, credentials
// present, from-address set where required) and actually delivers a small
// "it works!" message to the address the owner specifies. It does NOT log to
// the lead messages table — this is a config check, not a lead interaction —
// but it does record an entry in connector_activity_log so test sends are
// auditable.
const sendTestEmailSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(["gmail", "sendgrid"]),
  to: z.string().trim().email(),
});

export const sendTestEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof sendTestEmailSchema>) => sendTestEmailSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; messageId: string | null }> => {
    // Owner-only — same gate as the rest of the Integrations settings.
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("organization_id", data.organizationId)
      .eq("role", "owner")
      .maybeSingle();
    if (!roleRow) throw new Error("Only the organization owner can send test emails.");

    const subject = "Test email from your CRM";
    const body = [
      "This is a test email from your CRM's Settings → Integrations page.",
      "",
      `Provider: ${data.provider === "gmail" ? "Gmail" : "SendGrid"}`,
      `Sent at: ${new Date().toUTCString()}`,
      "",
      "If you're reading this, your integration is configured correctly and ready to send outreach to leads.",
    ].join("\n");

    if (data.provider === "gmail") {
      const { meta, config } = await assertMemberAndConnector(
        context.userId,
        data.organizationId,
        "gmail",
      );
      const fromAddress =
        typeof config.fromAddress === "string" ? config.fromAddress : undefined;

      try {
        const raw = buildGmailRawMessage({
          from: fromAddress,
          to: data.to,
          subject,
          body,
        });
        const result = await callGateway<{ id?: string; threadId?: string }>({
          connectorId: meta.connectorId,
          envVar: meta.envVar,
          path: "/gmail/v1/users/me/messages/send",
          body: { raw },
        });
        await recordConnectorActivity({
          organizationId: data.organizationId,
          userId: context.userId,
          leadId: null,
          provider: "gmail",
          direction: "outbound",
          action: "send_email",
          summary: `Test email sent to ${data.to}`,
          payload: { test: true, gmailId: result.id, threadId: result.threadId },
        });
        return { ok: true, messageId: result.id ?? null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await recordConnectorActivity({
          organizationId: data.organizationId,
          userId: context.userId,
          leadId: null,
          provider: "gmail",
          direction: "outbound",
          action: "send_email",
          status: "failed",
          errorMessage: msg,
          payload: { test: true, to: data.to },
        });
        throw err;
      }
    }

    // ----- SendGrid path -----
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profile?.organization_id !== data.organizationId) {
      throw new Error("Not a member of that organization.");
    }

    const { data: row } = await supabaseAdmin
      .from("org_integrations")
      .select("api_key, config")
      .eq("organization_id", data.organizationId)
      .eq("provider", "sendgrid")
      .maybeSingle();

    if (!row?.api_key) {
      throw new Error("SendGrid is not configured. Add an API key first.");
    }
    const cfg = (row.config as Record<string, unknown> | null) ?? {};
    const fromAddress =
      (typeof cfg.defaultFromAddress === "string" ? cfg.defaultFromAddress : undefined) ??
      (typeof cfg.fromAddress === "string" ? cfg.fromAddress : undefined);
    if (!fromAddress) {
      throw new Error(
        "No SendGrid 'from' address configured. Set a Send-from address before testing.",
      );
    }

    try {
      const result = await sendSendgridEmail({
        apiKey: row.api_key,
        from: fromAddress,
        to: data.to,
        subject,
        html: plainTextToHtml(body),
      });
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: null,
        provider: "sendgrid",
        direction: "outbound",
        action: "send_email",
        summary: `Test email sent to ${data.to}`,
        payload: { test: true, messageId: result.messageId, from: fromAddress },
      });
      return { ok: true, messageId: result.messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        leadId: null,
        provider: "sendgrid",
        direction: "outbound",
        action: "send_email",
        status: "failed",
        errorMessage: msg,
        payload: { test: true, to: data.to },
      });
      throw err;
    }
  });
