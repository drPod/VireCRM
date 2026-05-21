import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { requireAuth } from "@/auth/server";
import { requireActiveSubscription } from "@/integrations/supabase/subscription-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { searchApolloPeople, revealApolloEmail, type ApolloError } from "@/lib/connectors/apollo";
import { searchHunterDomain, type HunterError } from "@/lib/connectors/hunter";
import { searchSnovDomain, type SnovError } from "@/lib/connectors/snov";
import { z } from "zod";
import { recordLeadSync } from "./_lead-sync-log";

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
export type FindLeadsErrorCode = "INTEGRATION_MISSING" | "QUOTA_EXCEEDED" | "PLATFORM_KEY_MISSING";

// Encode error code into the message so it survives serialization across the
// server-fn boundary (custom Error subclasses get flattened to plain Error).
function codedError(code: FindLeadsErrorCode, msg: string, meta?: Record<string, unknown>): Error {
  const payload = meta ? `::${JSON.stringify(meta)}` : "";
  return new Error(`[${code}] ${msg}${payload}`);
}

export interface FindLeadsResult {
  leads: SuggestedLead[];
  meta: {
    searched: number;
    revealed: number;
    provider: LeadProvider;
    keySource: "byo" | "platform";
  };
}

/**
 * Inner handler, extracted so unit tests can call it directly without the
 * TanStack Start middleware chain (auth + subscription). The exported
 * `findLeadsFn` below wraps this with middleware + input validation.
 *
 * `context.supabase` is typed `unknown` because TanStack's inferred middleware
 * context isn't exported as a nameable type — the runtime shape is the
 * user-scoped Supabase client from requireSupabaseAuth.
 */
export async function _findLeadsHandler(args: {
  data: z.infer<typeof findLeadsSchema>;
  context: { supabase: unknown; userId: string };
}): Promise<FindLeadsResult> {
  const { data, context } = args;
  const supabase = context.supabase as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: unknown,
        ) => {
          maybeSingle: () => Promise<{
            data: {
              organization_id?: string;
              ai_tokens_used?: number;
              ai_tokens_limit?: number;
            } | null;
          }>;
        };
      };
    };
  };
  const { userId } = context;
  const startedAt = Date.now();

  try {
    // 1. Org membership
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile || profile.organization_id !== data.organizationId) {
      setResponseStatus(403);
      throw new Error("Unauthorized: not a member of this organization");
    }

    // 2. Token budget (still applies — protects against runaway costs)
    const { data: org } = await supabase
      .from("organizations")
      .select("ai_tokens_used, ai_tokens_limit")
      .eq("id", data.organizationId)
      .maybeSingle();
    if (!org) throw new Error("Organization not found");
    if ((org.ai_tokens_used ?? 0) >= (org.ai_tokens_limit ?? 0)) {
      throw new Error("AI token limit reached. Upgrade your plan for more analyses.");
    }

    // 3. Dispatch by provider.
    const result =
      data.provider === "hunter" || data.provider === "snov"
        ? await runDomainSearchProvider(data, userId)
        : await runApolloProvider(data, userId);

    await recordLeadSync({
      organizationId: data.organizationId,
      userId,
      provider: result.meta.provider,
      source: "auto_find_search",
      status: result.leads.length > 0 ? "success" : "partial",
      fetched: result.meta.searched,
      revealed: result.leads.length,
      noEmail: Math.max(0, result.meta.revealed - result.leads.length),
      durationMs: Date.now() - startedAt,
      metadata: {
        requested_count: data.count,
        industry: data.industry ?? null,
        persona: data.persona ?? null,
        company_domain: data.companyDomain ?? null,
        key_source: result.meta.keySource,
      },
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const codeMatch = message.match(/^\[([A-Z_]+)\]/);
    const errorCode = codeMatch?.[1] ?? "UNKNOWN";
    await recordLeadSync({
      organizationId: data.organizationId,
      userId,
      provider: data.provider,
      source: "auto_find_search",
      status: errorCode === "QUOTA_EXCEEDED" ? "quota_exceeded" : "error",
      durationMs: Date.now() - startedAt,
      errorCode,
      errorMessage: message.slice(0, 500),
      metadata: {
        requested_count: data.count,
        industry: data.industry ?? null,
        persona: data.persona ?? null,
        company_domain: data.companyDomain ?? null,
      },
    });
    throw err;
  }
}

export const findLeadsFn = createServerFn({ method: "POST" })
  .middleware([requireAuth, requireActiveSubscription])
  .inputValidator((input: z.infer<typeof findLeadsSchema>) => findLeadsSchema.parse(input))
  .handler(_findLeadsHandler);

// ===== Apollo path (with platform-quota fallback) =====

async function runApolloProvider(
  data: z.infer<typeof findLeadsSchema>,
  userId: string,
): Promise<{
  leads: SuggestedLead[];
  meta: {
    searched: number;
    revealed: number;
    provider: LeadProvider;
    keySource: "byo" | "platform";
  };
}> {
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
        const now = new Date();
        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

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
        throw codedError(
          "PLATFORM_KEY_MISSING",
          "Platform Apollo key was rejected. Add your own Apollo key in Settings → Integrations to keep finding leads.",
        );
      }
      throw new Error("Apollo rejected the API key. Update it in Settings → Integrations.");
    }
    if (apErr.isCreditError) {
      if (keySource === "platform") {
        throw codedError(
          "PLATFORM_KEY_MISSING",
          "Platform Apollo workspace is temporarily out of credits. Add your own Apollo key in Settings → Integrations to keep finding leads.",
        );
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
}

// ===== Hunter / Snov path (domain-search, BYO-only) =====

// Strip protocol/path from a user-entered domain.
function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

async function runDomainSearchProvider(
  data: z.infer<typeof findLeadsSchema>,
  _userId: string,
): Promise<{
  leads: SuggestedLead[];
  meta: {
    searched: number;
    revealed: number;
    provider: LeadProvider;
    keySource: "byo" | "platform";
  };
}> {
  const provider = data.provider as "hunter" | "snov";
  const providerLabel = provider === "hunter" ? "Hunter.io" : "Snov.io";

  if (!data.companyDomain) {
    throw codedError(
      "INTEGRATION_MISSING",
      `${providerLabel} searches need a company domain (e.g. "stripe.com"). Add one and try again.`,
    );
  }
  const domain = normalizeDomain(data.companyDomain);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    throw new Error(`"${data.companyDomain}" doesn't look like a valid domain.`);
  }

  const { data: byoIntegration } = await supabaseAdmin
    .from("org_integrations")
    .select("api_key")
    .eq("organization_id", data.organizationId)
    .eq("provider", provider)
    .maybeSingle();

  if (!byoIntegration?.api_key) {
    throw codedError(
      "INTEGRATION_MISSING",
      `No ${providerLabel} API key configured. Ask your organization owner to add one in Settings → Integrations.`,
    );
  }
  const apiKey = byoIntegration.api_key;

  // Run the domain search.
  let companyName: string | undefined;
  let foundEmails: Array<{
    email: string;
    firstName: string | null;
    lastName: string | null;
    position: string | null;
    confidence: number | null;
  }> = [];
  let totalSearched = 0;

  try {
    if (provider === "hunter") {
      const result = await searchHunterDomain(apiKey, {
        domain,
        limit: Math.min(data.count * 2, 100),
      });
      companyName = result.organization;
      totalSearched = result.emails.length;
      foundEmails = result.emails.map((e) => ({
        email: e.value,
        firstName: e.first_name ?? null,
        lastName: e.last_name ?? null,
        position: e.position ?? null,
        confidence: e.confidence ?? null,
      }));
    } else {
      const result = await searchSnovDomain(apiKey, {
        domain,
        limit: Math.min(data.count * 2, 100),
        type: "personal",
      });
      companyName = result.companyName;
      totalSearched = result.emails.length;
      foundEmails = result.emails.map((e) => ({
        email: e.email,
        firstName: e.firstName ?? null,
        lastName: e.lastName ?? null,
        position: e.position ?? null,
        // Snov reports a status string; map "valid" → 90, otherwise null.
        confidence: e.status === "valid" ? 90 : null,
      }));
    }
  } catch (err) {
    const e = err as HunterError | SnovError;
    if (e.isAuthError) {
      throw new Error(
        `${providerLabel} rejected the API key. Update it in Settings → Integrations.`,
      );
    }
    if (e.isCreditError) {
      throw new Error(
        `Your ${providerLabel} account is out of credits or rate-limited. Top up and retry.`,
      );
    }
    throw new Error(e.message || `${providerLabel} search failed.`);
  }

  // Optional persona filter — soft match against position.
  const personaLc = data.persona?.toLowerCase().trim();
  const filtered = personaLc
    ? foundEmails.filter((e) => e.position?.toLowerCase().includes(personaLc))
    : foundEmails;

  const slice = filtered.slice(0, data.count);

  const company = companyName?.trim() || domain;
  const leads: SuggestedLead[] = slice.map((e) => {
    const fullName =
      [e.firstName, e.lastName].filter(Boolean).join(" ").trim() || e.email.split("@")[0];
    const role = e.position?.trim() || "Unknown role";
    const score = Math.min(
      100,
      50 + (e.confidence ?? 0) / 5 + (e.firstName ? 10 : 0) + (e.position ? 10 : 0),
    );
    return {
      name: fullName.slice(0, 200),
      email: e.email.slice(0, 255),
      company: company.slice(0, 200),
      role: role.slice(0, 200),
      score: Math.round(score),
      reason: `Verified by ${providerLabel} · ${company}${
        e.confidence != null ? ` · ${e.confidence}% confidence` : ""
      }`,
    };
  });

  await supabaseAdmin.rpc("increment_ai_tokens", { p_org_id: data.organizationId });

  return {
    leads,
    meta: {
      searched: totalSearched,
      revealed: leads.length,
      provider,
      keySource: "byo",
    },
  };
}

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
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof usageSchema>) => usageSchema.parse(input))
  .handler(async ({ data, context }): Promise<LeadUsage> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile || profile.organization_id !== data.organizationId) {
      setResponseStatus(403);
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

// ----- Record the manual import step (called from AutoFindLeadsDialog after insert) -----
const recordImportSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(["apollo", "hunter", "snov"]),
  fetched: z.number().int().min(0),
  inserted: z.number().int().min(0),
  duplicates: z.number().int().min(0).default(0),
  durationMs: z.number().int().min(0).default(0),
  errorMessage: z.string().max(500).optional(),
});

export const recordLeadImportFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof recordImportSchema>) => recordImportSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    // Membership check — only org members can write a log entry for that org.
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile || profile.organization_id !== data.organizationId) {
      setResponseStatus(403);
      throw new Error("Unauthorized");
    }

    await recordLeadSync({
      organizationId: data.organizationId,
      userId,
      provider: data.provider,
      source: "auto_find_import",
      status: data.errorMessage ? "error" : "success",
      fetched: data.fetched,
      inserted: data.inserted,
      duplicates: data.duplicates,
      durationMs: data.durationMs,
      errorMessage: data.errorMessage ?? null,
    });

    return { ok: true };
  });
