import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOrgMember } from "@/lib/auth-helpers";
import { z } from "zod";
import {
  audienceFilterSchema,
  resolveAudienceFilter,
  type AudienceFilter,
} from "@/lib/campaigns/audience-filter";

/**
 * Campaign builder server functions. One campaign owns exactly one linked
 * outreach_sequence (1:1 via outreach_sequences.campaign_id). Send execution
 * delegates to the existing dispatch-sequences cron + dispatchOutreachEmail.
 */

export interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  objective: string | null;
  status: "draft" | "scheduled" | "active" | "paused" | "completed";
  audience_filter: AudienceFilter | null;
  from_name: string | null;
  reply_to: string | null;
  scheduled_at: string | null;
  launched_at: string | null;
  completed_at: string | null;
  leads_count: number | null;
  sent_count: number | null;
  replies_count: number | null;
  created_at: string;
  updated_at: string;
  sequence_id: string | null;
}

const orgScope = z.object({ organizationId: z.string().uuid() });
const idScope = orgScope.extend({ campaignId: z.string().uuid() });

const createDraftSchema = orgScope.extend({
  name: z.string().min(1).max(200),
  objective: z.string().max(500).nullable().optional(),
});

export const createDraftCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof createDraftSchema>) => createDraftSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ campaignId: string; sequenceId: string }> => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organizationId);

    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .insert({
        organization_id: data.organizationId,
        name: data.name,
        objective: data.objective ?? null,
        status: "draft",
      })
      .select("id")
      .single();
    if (cErr || !campaign) throw new Error(cErr?.message || "Failed to create campaign");

    const { data: sequence, error: sErr } = await supabase
      .from("outreach_sequences")
      .insert({
        organization_id: data.organizationId,
        campaign_id: campaign.id,
        name: data.name,
        status: "draft",
        created_by: userId,
      })
      .select("id")
      .single();
    if (sErr || !sequence) {
      await supabase.from("campaigns").delete().eq("id", campaign.id);
      throw new Error(sErr?.message || "Failed to create linked sequence");
    }

    return { campaignId: campaign.id, sequenceId: sequence.id };
  });

export const getCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof idScope>) => idScope.parse(input))
  .handler(async ({ data, context }): Promise<Campaign> => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organizationId);

    const { data: row, error } = await supabase
      .from("campaigns")
      .select("*, outreach_sequences!outreach_sequences_campaign_id_fkey(id)")
      .eq("id", data.campaignId)
      .eq("organization_id", data.organizationId)
      .single();
    if (error || !row) throw new Error(error?.message || "Campaign not found");

    const r = row as Record<string, unknown> & {
      outreach_sequences?: { id: string }[] | null;
      audience_filter?: unknown;
    };
    const seq = r.outreach_sequences ?? null;
    return {
      ...(r as unknown as Campaign),
      audience_filter: (r.audience_filter ?? null) as AudienceFilter | null,
      sequence_id: seq && seq.length ? seq[0].id : null,
    };
  });

const updateDetailsSchema = idScope.extend({
  name: z.string().min(1).max(200).optional(),
  objective: z.string().max(500).nullable().optional(),
  from_name: z.string().max(200).nullable().optional(),
  reply_to: z.string().email().nullable().optional(),
  audience_filter: audienceFilterSchema.nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
});

export const updateCampaignDetailsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof updateDetailsSchema>) => updateDetailsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organizationId);

    const { organizationId, campaignId, ...fields } = data;
    const patch: {
      name?: string;
      objective?: string | null;
      from_name?: string | null;
      reply_to?: string | null;
      audience_filter?: AudienceFilter | null;
      scheduled_at?: string | null;
    } = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.objective !== undefined) patch.objective = fields.objective;
    if (fields.from_name !== undefined) patch.from_name = fields.from_name;
    if (fields.reply_to !== undefined) patch.reply_to = fields.reply_to;
    if (fields.audience_filter !== undefined) patch.audience_filter = fields.audience_filter;
    if (fields.scheduled_at !== undefined) patch.scheduled_at = fields.scheduled_at;

    const { error } = await supabase
      .from("campaigns")
      .update(patch)
      .eq("id", campaignId)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);

    if (patch.name) {
      await supabase
        .from("outreach_sequences")
        .update({ name: patch.name })
        .eq("campaign_id", campaignId)
        .eq("organization_id", organizationId);
    }

    return { success: true as const };
  });

export const previewCampaignAudienceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof idScope>) => idScope.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      count: number;
      sample: Array<{ id: string; name: string; email: string | null; company: string | null }>;
      excluded: { no_email: number; suppressed: number };
    }> => {
      const { supabase, userId } = context;
      await assertOrgMember(supabase, userId, data.organizationId);

      const { data: campaign, error: cErr } = await supabase
        .from("campaigns")
        .select("audience_filter")
        .eq("id", data.campaignId)
        .eq("organization_id", data.organizationId)
        .single();
      if (cErr || !campaign) throw new Error(cErr?.message || "Campaign not found");

      const filter = (campaign.audience_filter ?? {}) as AudienceFilter;
      const leads = await resolveAudienceFilter(supabase, data.organizationId, filter);

      const noEmail = leads.filter((l) => !l.email).length;
      const withEmail = leads.filter((l) => l.email);

      let suppressed = 0;
      if (withEmail.length > 0) {
        const emails = withEmail.map((l) => l.email).filter((e): e is string => Boolean(e));
        const { data: supp } = await supabase
          .from("suppressed_emails")
          .select("email")
          .in("email", emails);
        suppressed = supp?.length ?? 0;
      }

      return {
        count: withEmail.length - suppressed,
        sample: withEmail.slice(0, 10).map((l) => ({
          id: l.id,
          name: l.name,
          email: l.email,
          company: l.company,
        })),
        excluded: { no_email: noEmail, suppressed },
      };
    },
  );

const launchSchema = idScope.extend({
  mode: z.enum(["now", "scheduled"]),
});

export const launchCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof launchSchema>) => launchSchema.parse(input))
  .handler(
    async ({ data, context }): Promise<{ enrolled: number; status: "active" | "scheduled" }> => {
      const { supabase, userId } = context;
      await assertOrgMember(supabase, userId, data.organizationId);

      const { data: campaign, error: cErr } = await supabase
        .from("campaigns")
        .select(
          "id, audience_filter, scheduled_at, status, outreach_sequences!outreach_sequences_campaign_id_fkey(id)",
        )
        .eq("id", data.campaignId)
        .eq("organization_id", data.organizationId)
        .single();
      if (cErr || !campaign) throw new Error(cErr?.message || "Campaign not found");

      const seqRows = (campaign as { outreach_sequences?: { id: string }[] | null })
        .outreach_sequences;
      const sequenceId = seqRows && seqRows.length ? seqRows[0].id : null;
      if (!sequenceId) throw new Error("Campaign has no linked sequence");

      const { count: stepCount } = await supabase
        .from("outreach_sequence_steps")
        .select("id", { count: "exact", head: true })
        .eq("sequence_id", sequenceId)
        .eq("organization_id", data.organizationId);
      if (!stepCount || stepCount === 0) {
        throw new Error("Campaign needs at least one step before launch");
      }

      if (data.mode === "scheduled") {
        if (!campaign.scheduled_at) throw new Error("scheduled_at must be set");
        if (new Date(campaign.scheduled_at).getTime() <= Date.now()) {
          throw new Error("scheduled_at must be in the future");
        }
        const { error } = await supabase
          .from("campaigns")
          .update({ status: "scheduled" })
          .eq("id", data.campaignId)
          .eq("organization_id", data.organizationId);
        if (error) throw new Error(error.message);
        return { enrolled: 0, status: "scheduled" };
      }

      const filter = ((campaign as { audience_filter: unknown }).audience_filter ??
        {}) as AudienceFilter;
      const leads = await resolveAudienceFilter(supabase, data.organizationId, filter);
      const withEmail = leads.filter((l) => l.email);
      if (withEmail.length === 0) {
        throw new Error("Audience filter resolves to zero leads with email");
      }

      const emails = withEmail.map((l) => l.email).filter((e): e is string => Boolean(e));
      const { data: supp } = await supabase
        .from("suppressed_emails")
        .select("email")
        .in("email", emails);
      const suppressedSet = new Set((supp ?? []).map((r) => r.email));
      const eligible = withEmail.filter((l) => l.email && !suppressedSet.has(l.email));

      const { data: firstStep } = await supabase
        .from("outreach_sequence_steps")
        .select("delay_days, delay_hours")
        .eq("sequence_id", sequenceId)
        .eq("organization_id", data.organizationId)
        .order("step_index", { ascending: true })
        .limit(1)
        .maybeSingle();

      const now = new Date();
      const step = firstStep as { delay_days: number; delay_hours: number } | null;
      const nextSend = step
        ? new Date(
            now.getTime() +
              step.delay_days * 24 * 60 * 60 * 1000 +
              step.delay_hours * 60 * 60 * 1000,
          ).toISOString()
        : now.toISOString();

      const rows = eligible.map((l) => ({
        organization_id: data.organizationId,
        sequence_id: sequenceId,
        lead_id: l.id,
        current_step_index: 0,
        next_send_at: nextSend,
        status: "active",
        enrolled_by: userId,
      }));

      const { data: inserted, error: insErr } = await supabase
        .from("outreach_sequence_enrollments")
        .upsert(rows, { onConflict: "sequence_id,lead_id", ignoreDuplicates: true })
        .select("id");
      if (insErr) throw new Error(insErr.message);

      const launchedAt = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("campaigns")
        .update({ status: "active", launched_at: launchedAt })
        .eq("id", data.campaignId)
        .eq("organization_id", data.organizationId);
      if (upErr) throw new Error(upErr.message);

      await supabase
        .from("outreach_sequences")
        .update({ status: "active" })
        .eq("id", sequenceId)
        .eq("organization_id", data.organizationId);

      return { enrolled: inserted?.length || 0, status: "active" };
    },
  );

const statusOnly = idScope;

export const pauseCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof statusOnly>) => statusOnly.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organizationId);

    await supabase
      .from("campaigns")
      .update({ status: "paused" })
      .eq("id", data.campaignId)
      .eq("organization_id", data.organizationId);
    await supabase
      .from("outreach_sequences")
      .update({ status: "paused" })
      .eq("campaign_id", data.campaignId)
      .eq("organization_id", data.organizationId);
    return { success: true as const };
  });

export const resumeCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof statusOnly>) => statusOnly.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organizationId);

    await supabase
      .from("campaigns")
      .update({ status: "active" })
      .eq("id", data.campaignId)
      .eq("organization_id", data.organizationId);
    await supabase
      .from("outreach_sequences")
      .update({ status: "active" })
      .eq("campaign_id", data.campaignId)
      .eq("organization_id", data.organizationId);
    return { success: true as const };
  });

export const completeCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof statusOnly>) => statusOnly.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organizationId);

    await supabase
      .from("campaigns")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", data.campaignId)
      .eq("organization_id", data.organizationId);
    await supabase
      .from("outreach_sequences")
      .update({ status: "archived" })
      .eq("campaign_id", data.campaignId)
      .eq("organization_id", data.organizationId);
    return { success: true as const };
  });

export const deleteCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof statusOnly>) => statusOnly.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organizationId);

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", data.campaignId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { success: true as const };
  });
