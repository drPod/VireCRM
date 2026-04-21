import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/integrations/supabase/subscription-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { searchApolloPeople, revealApolloEmail, type ApolloError } from "@/lib/apollo";
import { z } from "zod";

const findLeadsSchema = z.object({
  organizationId: z.string().uuid(),
  businessDescription: z.string().max(5000).optional(),
  industry: z.string().min(1).max(200).optional(),
  persona: z.string().min(1).max(200).optional(),
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

export class IntegrationMissingError extends Error {
  code = "INTEGRATION_MISSING" as const;
}

export const findLeadsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveSubscription])
  .inputValidator((input: z.infer<typeof findLeadsSchema>) => findLeadsSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ leads: SuggestedLead[]; meta: { searched: number; revealed: number; provider: "apollo" } }> => {
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

    // 3. Load Apollo key (server-side only, via service role)
    const { data: integration } = await supabaseAdmin
      .from("org_integrations")
      .select("api_key")
      .eq("organization_id", data.organizationId)
      .eq("provider", "apollo")
      .maybeSingle();

    if (!integration?.api_key) {
      throw new IntegrationMissingError(
        "No Apollo.io API key configured. Ask your organization owner to add one in Settings → Integrations.",
      );
    }

    // 4. Build Apollo search params from the user's filters.
    const personTitles = data.persona ? [data.persona] : undefined;
    const qOrganizationKeywordTags = data.industry ? [data.industry] : undefined;
    // Over-fetch so we can drop people whose emails fail to reveal and still hit `count`.
    const overFetch = Math.min(Math.ceil(data.count * 2), 50);

    let people;
    try {
      people = await searchApolloPeople(integration.api_key, {
        personTitles,
        qOrganizationKeywordTags,
        perPage: overFetch,
        page: 1,
      });
    } catch (err) {
      const apErr = err as ApolloError;
      if (apErr.isAuthError) throw new Error("Apollo rejected the API key. Update it in Settings → Integrations.");
      if (apErr.isCreditError) throw new Error("Apollo workspace is out of credits. Top up at apollo.io.");
      throw new Error(apErr.message || "Apollo search failed.");
    }

    if (people.length === 0) {
      return { leads: [], meta: { searched: 0, revealed: 0, provider: "apollo" } };
    }

    // 5. Reveal emails sequentially. Each reveal = 1 Apollo credit, so we
    // stop the moment we have `count` good leads to avoid over-charging.
    const revealed: SuggestedLead[] = [];
    let revealAttempts = 0;
    for (const person of people) {
      if (revealed.length >= data.count) break;
      revealAttempts++;

      let email: string | null = null;
      let phone: string | null = null;
      try {
        const result = await revealApolloEmail(integration.api_key, person);
        email = result.email;
        phone = result.phone;
      } catch (err) {
        const apErr = err as ApolloError;
        if (apErr.isAuthError) throw new Error("Apollo API key was revoked mid-search.");
        if (apErr.isCreditError) {
          // Out of credits — return whatever we have so far rather than failing hard.
          break;
        }
        // Transient single-person failure — skip and keep going.
        continue;
      }

      if (!email) continue; // Apollo couldn't verify this one

      const fullName =
        person.name?.trim() ||
        [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
        "Unknown";
      const company = person.organization?.name?.trim() || "Unknown company";
      const role = person.title?.trim() || "Unknown role";
      // Naive score: weight by company size + completeness. Real scoring
      // can be tuned later from feedback.
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

    // Bump org token counter once per discovery call.
    await supabaseAdmin.rpc("increment_ai_tokens", { p_org_id: data.organizationId });

    return {
      leads: revealed,
      meta: { searched: people.length, revealed: revealAttempts, provider: "apollo" },
    };
  });
