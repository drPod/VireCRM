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
