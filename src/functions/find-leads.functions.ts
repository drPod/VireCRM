import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/integrations/supabase/subscription-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { searchApolloPeople, revealApolloEmail, type ApolloError } from "@/lib/apollo";
import { searchHunterDomain, type HunterError } from "@/lib/hunter";
import { searchSnovDomain, type SnovError } from "@/lib/snov";
import { z } from "zod";

export type LeadProvider = "apollo" | "hunter" | "snov";

const findLeadsSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(["apollo", "hunter", "snov"]).default("apollo"),
  businessDescription: z.string().max(5000).optional(),
  industry: z.string().min(1).max(200).optional(),
  persona: z.string().min(1).max(200).optional(),
  /** Required for hunter & snov (domain-search providers). */
  companyDomain: z.string().min(3).max(253).optional(),
  count: z.number().min(1).max(20).default(10),
});

export interface SuggestedLead {
  name: string;
  email: string;
  phone?: string;
  company: string;
  role: string;
  score: number;
  reason: string;
}

// Error codes the UI matches against to render the right CTA.
export type FindLeadsErrorCode =
  | "INTEGRATION_MISSING"
  | "QUOTA_EXCEEDED"
  | "PLATFORM_KEY_MISSING";

// Encode error code into the message so it survives serialization across the
// server-fn boundary (custom Error subclasses get flattened to plain Error).
function codedError(code: FindLeadsErrorCode, msg: string, meta?: Record<string, unknown>): Error {
  const payload = meta ? `::${JSON.stringify(meta)}` : "";
  return new Error(`[${code}] ${msg}${payload}`);
}

export const findLeadsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveSubscription])
  .inputValidator((input: z.infer<typeof findLeadsSchema>) => findLeadsSchema.parse(input))
  .handler(async ({ data, context }): Promise<{
    leads: SuggestedLead[];
    meta: { searched: number; revealed: number; provider: "apollo"; keySource: "byo" | "platform" };
  }> => {
    const { supabase, userId } = context;

    // 1. Org membership
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile || profile.organization_id !== data.organizationId) {
      throw new Error("Unauthorized: not a member of this organization");
    }

    // 2. Token budget (still applies — protects against runaway costs)
    const { data: org } = await supabase
      .from("organizations")
      .select("ai_tokens_used, ai_tokens_limit")
      .eq("id", data.organizationId)
      .maybeSingle();
    if (!org) throw new Error("Organization not found");
    if (org.ai_tokens_used >= org.ai_tokens_limit) {
      throw new Error("AI token limit reached. Upgrade your plan for more analyses.");
    }

    // 3. Pick the Apollo key:
    //    - BYO key on the org → use it, no platform quota check.
    //    - Otherwise → fall back to platform key gated by monthly cap.
    const { data: byoIntegration } = await supabaseAdmin
      .from("org_integrations")
      .select("api_key")
      .eq("organization_id", data.organizationId)
      .eq("provider", "apollo")
      .maybeSingle();

    let apolloKey: string | null = byoIntegration?.api_key ?? null;
    let keySource: "byo" | "platform" = "byo";

    if (!apolloKey) {
      const platformKey = process.env.PLATFORM_APOLLO_API_KEY;
      if (!platformKey) {
        throw codedError(
          "INTEGRATION_MISSING",
          "No Apollo.io API key configured. Ask your organization owner to add one in Settings → Integrations.",
        );
      }

      // Reserve quota upfront — refunded later if we don't use it all.
      const { data: quotaCheck, error: quotaErr } = await supabaseAdmin.rpc(
        "consume_platform_lead_quota",
        { p_org_id: data.organizationId, p_count: data.count },
      );
      if (quotaErr) throw new Error(`Quota check failed: ${quotaErr.message}`);

      const q = quotaCheck as {
        ok: boolean;
        error?: string;
        used?: number;
        quota?: number;
        remaining?: number;
      };
      if (!q.ok) {
        if (q.error === "quota_exceeded") {
          // Compute the next reset (1st of next month, UTC) so the UI can tell
          // the user exactly when retries will start succeeding again.
          const now = new Date();
          const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

          // Log the blocked attempt so owners can see how often they're hitting
          // the cap and decide whether to upgrade or add a BYO key.
          await supabaseAdmin.from("ai_call_log").insert({
            organization_id: data.organizationId,
            user_id: userId,
            feature: "find_leads",
            model: "apollo",
            status: "quota_exceeded",
            latency_ms: 0,
            attempt_index: 0,
            error_message: `Monthly lead quota reached (${q.used}/${q.quota})`,
            metadata: {
              requested_count: data.count,
              used: q.used,
              quota: q.quota,
              period_end: periodEnd.toISOString(),
              key_source: "platform",
            },
          });

          throw codedError(
            "QUOTA_EXCEEDED",
            `You've used all ${q.quota} of your monthly lead credits. They reset on ${periodEnd.toISOString().slice(0, 10)}. Upgrade your plan for more, or add your own Apollo key for unlimited.`,
            { used: q.used, quota: q.quota, periodEnd: periodEnd.toISOString() },
          );
        }
        throw new Error(q.error || "Quota check failed");
      }

      apolloKey = platformKey;
      keySource = "platform";
    }

    // 4. Apollo search
    const personTitles = data.persona ? [data.persona] : undefined;
    const qOrganizationKeywordTags = data.industry ? [data.industry] : undefined;
    const overFetch = Math.min(Math.ceil(data.count * 2), 50);

    let people;
    try {
      people = await searchApolloPeople(apolloKey, {
        personTitles,
        qOrganizationKeywordTags,
        perPage: overFetch,
        page: 1,
      });
    } catch (err) {
      if (keySource === "platform") {
        await refundPlatformQuota(data.organizationId, data.count);
      }
      const apErr = err as ApolloError;
      if (apErr.isAuthError) {
        if (keySource === "platform") {
          throw codedError("PLATFORM_KEY_MISSING", "Platform Apollo key was rejected. Add your own Apollo key in Settings → Integrations to keep finding leads.");
        }
        throw new Error("Apollo rejected the API key. Update it in Settings → Integrations.");
      }
      if (apErr.isCreditError) {
        if (keySource === "platform") {
          throw codedError("PLATFORM_KEY_MISSING", "Platform Apollo workspace is temporarily out of credits. Add your own Apollo key in Settings → Integrations to keep finding leads.");
        }
        throw new Error("Your Apollo workspace is out of credits. Top up at apollo.io.");
      }
      throw new Error(apErr.message || "Apollo search failed.");
    }

    if (people.length === 0) {
      if (keySource === "platform") {
        await refundPlatformQuota(data.organizationId, data.count);
      }
      return { leads: [], meta: { searched: 0, revealed: 0, provider: "apollo", keySource } };
    }

    // 5. Reveal emails sequentially
    const revealed: SuggestedLead[] = [];
    let revealAttempts = 0;
    for (const person of people) {
      if (revealed.length >= data.count) break;
      revealAttempts++;

      let email: string | null = null;
      let phone: string | null = null;
      try {
        const result = await revealApolloEmail(apolloKey, person);
        email = result.email;
        phone = result.phone;
      } catch (err) {
        const apErr = err as ApolloError;
        if (apErr.isAuthError) {
          if (keySource === "platform") {
            await refundPlatformQuota(data.organizationId, data.count - revealed.length);
            throw codedError("PLATFORM_KEY_MISSING", "Platform Apollo key was revoked mid-search.");
          }
          throw new Error("Apollo API key was revoked mid-search.");
        }
        if (apErr.isCreditError) break;
        continue;
      }

      if (!email) continue;

      const fullName =
        person.name?.trim() ||
        [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
        "Unknown";
      const company = person.organization?.name?.trim() || "Unknown company";
      const role = person.title?.trim() || "Unknown role";
      const employees = person.organization?.estimated_num_employees ?? 0;
      const score = Math.min(
        100,
        50 +
          (employees > 50 ? 15 : employees > 10 ? 10 : 5) +
          (person.title ? 10 : 0) +
          (person.linkedin_url ? 10 : 0),
      );

      revealed.push({
        name: fullName.slice(0, 200),
        email: email.slice(0, 255),
        phone: phone?.slice(0, 50),
        company: company.slice(0, 200),
        role: role.slice(0, 200),
        score,
        reason: `Verified by Apollo · ${person.organization?.industry ?? "unknown industry"}${
          employees ? ` · ~${employees} employees` : ""
        }`,
      });
    }

    // 6. Refund any unused platform quota (we reserved data.count upfront).
    if (keySource === "platform" && revealed.length < data.count) {
      await refundPlatformQuota(data.organizationId, data.count - revealed.length);
    }

    await supabaseAdmin.rpc("increment_ai_tokens", { p_org_id: data.organizationId });

    return {
      leads: revealed,
      meta: { searched: people.length, revealed: revealAttempts, provider: "apollo", keySource },
    };
  });

// Refund quota by decrementing directly — bypasses the consume function's cap check.
async function refundPlatformQuota(orgId: string, count: number) {
  if (count <= 0) return;
  const { data } = await supabaseAdmin
    .from("organizations")
    .select("leads_used_this_period")
    .eq("id", orgId)
    .maybeSingle();
  const current = data?.leads_used_this_period ?? 0;
  await supabaseAdmin
    .from("organizations")
    .update({ leads_used_this_period: Math.max(0, current - count) })
    .eq("id", orgId);
}

// ----- Lead usage server fn (for the UI badge) -----
const usageSchema = z.object({ organizationId: z.string().uuid() });

export interface LeadUsage {
  used: number;
  quota: number;
  remaining: number;
  /** True if org has its own Apollo key — quota doesn't apply. */
  hasByoKey: boolean;
}

export const getLeadUsageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof usageSchema>) => usageSchema.parse(input))
  .handler(async ({ data, context }): Promise<LeadUsage> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile || profile.organization_id !== data.organizationId) {
      throw new Error("Unauthorized");
    }

    const [{ data: usage }, { data: byo }] = await Promise.all([
      supabaseAdmin.rpc("get_lead_usage", { p_org_id: data.organizationId }),
      supabaseAdmin
        .from("org_integrations")
        .select("id")
        .eq("organization_id", data.organizationId)
        .eq("provider", "apollo")
        .maybeSingle(),
    ]);

    const u = usage as { used?: number; quota?: number; remaining?: number } | null;
    return {
      used: u?.used ?? 0,
      quota: u?.quota ?? 0,
      remaining: u?.remaining ?? 0,
      hasByoKey: !!byo,
    };
  });
