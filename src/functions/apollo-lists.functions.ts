// Server functions for importing leads from saved Apollo.io lists.
// Requires the org to have its OWN Apollo API key configured. Each email
// reveal also counts against the org's monthly platform lead quota — we
// reserve quota upfront and refund any unused credits at the end.
import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/auth/server";
import { requireActiveSubscription } from "@/integrations/supabase/subscription-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  listApolloLists,
  getApolloListMembers,
  revealApolloEmail,
  type ApolloError,
  type ApolloPerson,
} from "@/lib/connectors/apollo";
import { assertOrgMember } from "@/lib/auth-helpers";
import { z } from "zod";
import { recordLeadSync } from "./_lead-sync-log";

// Hard cap per import to protect against runaway Apollo cost (each lead = 1 credit).
const MAX_IMPORT_PER_RUN = 200;

type ApolloErrorCode = "INTEGRATION_MISSING" | "AUTH" | "CREDITS" | "QUOTA_EXCEEDED";
function codedError(code: ApolloErrorCode, msg: string, extra?: Record<string, unknown>): Error {
  const e = new Error(`[${code}] ${msg}`);
  if (extra) Object.assign(e, extra);
  return e;
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

async function getOrgApolloKey(organizationId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("org_integrations")
    .select("api_key")
    .eq("organization_id", organizationId)
    .eq("provider", "apollo")
    .maybeSingle();
  if (!data?.api_key) {
    throw codedError(
      "INTEGRATION_MISSING",
      "Saved-list import requires your own Apollo API key. Add one in Settings → Integrations.",
    );
  }
  return data.api_key;
}

// ----- LIST AVAILABLE APOLLO LISTS -----
const listSchema = z.object({ organizationId: z.string().uuid() });

export interface ApolloListSummary {
  id: string;
  name: string;
  count: number | null;
}

export const listApolloListsFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof listSchema>) => listSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ lists: ApolloListSummary[] }> => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organizationId);
    const apiKey = await getOrgApolloKey(data.organizationId);

    try {
      const lists = await listApolloLists(apiKey);
      return {
        lists: lists.map((l) => ({
          id: l.id,
          name: l.name,
          count: l.cached_count ?? null,
        })),
      };
    } catch (err) {
      const apErr = err as ApolloError;
      if (apErr.isAuthError) {
        throw codedError(
          "AUTH",
          "Apollo rejected your API key. Update it in Settings → Integrations.",
        );
      }
      throw new Error(apErr.message || "Failed to load Apollo lists.");
    }
  });

// ----- IMPORT A LIST -----
const importSchema = z.object({
  organizationId: z.string().uuid(),
  listId: z.string().min(1).max(100),
  listName: z.string().min(1).max(200),
  /** How many leads to pull this run (capped at MAX_IMPORT_PER_RUN). */
  maxLeads: z.number().int().min(1).max(MAX_IMPORT_PER_RUN).default(50),
});

export interface ImportResult {
  fetched: number;
  revealed: number;
  inserted: number;
  duplicates: number;
  noEmail: number;
}

export const importApolloListFn = createServerFn({ method: "POST" })
  .middleware([requireAuth, requireActiveSubscription])
  .inputValidator((input: z.infer<typeof importSchema>) => importSchema.parse(input))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const { supabase, userId } = context;
    const startedAt = Date.now();

    try {
      await assertOrgMember(supabase, userId, data.organizationId);
      const apiKey = await getOrgApolloKey(data.organizationId);

      // 1. Pull list members (paginate until we have enough)
      const collected: ApolloPerson[] = [];
      let page = 1;
      while (collected.length < data.maxLeads) {
        try {
          const { people, totalPages } = await getApolloListMembers(apiKey, data.listId, {
            page,
            perPage: 100,
          });
          if (people.length === 0) break;
          collected.push(...people);
          if (page >= totalPages) break;
          page++;
        } catch (err) {
          const apErr = err as ApolloError;
          if (apErr.isAuthError) {
            throw codedError("AUTH", "Apollo rejected your API key during list fetch.");
          }
          throw new Error(apErr.message || "Failed to fetch list members.");
        }
      }

      const slice = collected.slice(0, data.maxLeads);

      if (slice.length === 0) {
        const result = {
          fetched: collected.length,
          revealed: 0,
          inserted: 0,
          duplicates: 0,
          noEmail: 0,
        };
        await recordLeadSync({
          organizationId: data.organizationId,
          userId,
          provider: "apollo",
          source: "apollo_list_import",
          status: "success",
          fetched: collected.length,
          durationMs: Date.now() - startedAt,
          metadata: { list_id: data.listId, list_name: data.listName, reason: "empty_list" },
        });
        return result;
      }

      // 2. Reserve monthly platform quota upfront — one credit per planned reveal.
      const { data: quotaCheck, error: quotaErr } = await supabaseAdmin.rpc(
        "consume_platform_lead_quota",
        { p_org_id: data.organizationId, p_count: slice.length },
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
            feature: "apollo_list_import",
            model: "apollo",
            status: "quota_exceeded",
            latency_ms: 0,
            attempt_index: 0,
            error_message: `Monthly lead quota reached (${q.used}/${q.quota})`,
            metadata: {
              requested_count: slice.length,
              list_id: data.listId,
              list_name: data.listName,
              used: q.used,
              quota: q.quota,
              period_end: periodEnd.toISOString(),
              key_source: "byo",
            },
          });

          throw codedError(
            "QUOTA_EXCEEDED",
            `You've used all ${q.quota} of your monthly lead credits. They reset on ${periodEnd.toISOString().slice(0, 10)}. Upgrade your plan for more.`,
            { used: q.used, quota: q.quota, periodEnd: periodEnd.toISOString() },
          );
        }
        throw new Error(q.error || "Quota check failed");
      }

      // 3. Reveal emails sequentially.
      const enriched: Array<{ person: ApolloPerson; email: string; phone: string | null }> = [];
      let creditExhausted = false;
      for (const person of slice) {
        try {
          const { email, phone } = await revealApolloEmail(apiKey, person);
          if (email) enriched.push({ person, email, phone });
        } catch (err) {
          const apErr = err as ApolloError;
          if (apErr.isCreditError) {
            creditExhausted = true;
            break;
          }
          if (apErr.isAuthError) {
            await refundPlatformQuota(data.organizationId, slice.length - enriched.length);
            throw codedError("AUTH", "Apollo API key was revoked mid-import.");
          }
          // Non-fatal: skip this person and continue
        }
      }

      // Refund any reserved quota we didn't actually use.
      const unusedQuota = slice.length - enriched.length;
      if (unusedQuota > 0) {
        await refundPlatformQuota(data.organizationId, unusedQuota);
      }

      if (creditExhausted && enriched.length === 0) {
        throw codedError(
          "CREDITS",
          "Your Apollo workspace ran out of email credits before any leads could be imported. Top up at apollo.io and retry.",
        );
      }

      if (enriched.length === 0) {
        const result = {
          fetched: collected.length,
          revealed: 0,
          inserted: 0,
          duplicates: 0,
          noEmail: slice.length,
        };
        await recordLeadSync({
          organizationId: data.organizationId,
          userId,
          provider: "apollo",
          source: "apollo_list_import",
          status: "partial",
          fetched: collected.length,
          revealed: 0,
          noEmail: slice.length,
          durationMs: Date.now() - startedAt,
          metadata: {
            list_id: data.listId,
            list_name: data.listName,
            credit_exhausted: creditExhausted,
          },
        });
        return result;
      }

      // 4. Dedupe against existing leads in this org by email (case-insensitive).
      const emails = enriched.map((e) => e.email.toLowerCase());
      const { data: existing } = await supabaseAdmin
        .from("leads")
        .select("email")
        .eq("organization_id", data.organizationId)
        .in("email", emails);
      const existingSet = new Set(
        (existing ?? []).map((r) => r.email?.toLowerCase()).filter(Boolean),
      );

      const toInsert = enriched
        .filter((e) => !existingSet.has(e.email.toLowerCase()))
        .map(({ person, email, phone }) => {
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
          return {
            organization_id: data.organizationId,
            name: fullName.slice(0, 200),
            email: email.slice(0, 255),
            phone: phone?.slice(0, 50) ?? null,
            company: company.slice(0, 200),
            status: "new" as const,
            score,
            notes: `Role: ${role}\nImported from Apollo list: ${data.listName}${
              person.organization?.industry ? `\nIndustry: ${person.organization.industry}` : ""
            }${person.linkedin_url ? `\nLinkedIn: ${person.linkedin_url}` : ""}`,
            source: `apollo_list:${data.listName}`.slice(0, 100),
            created_by: userId,
          };
        });

      let inserted = 0;
      if (toInsert.length > 0) {
        const { error: insertErr, count } = await supabaseAdmin
          .from("leads")
          .insert(toInsert, { count: "exact" });
        if (insertErr) {
          throw new Error(`Failed to insert leads: ${insertErr.message}`);
        }
        inserted = count ?? toInsert.length;
      }

      const result: ImportResult = {
        fetched: collected.length,
        revealed: enriched.length,
        inserted,
        duplicates: enriched.length - toInsert.length,
        noEmail: slice.length - enriched.length,
      };

      await recordLeadSync({
        organizationId: data.organizationId,
        userId,
        provider: "apollo",
        source: "apollo_list_import",
        status: creditExhausted ? "partial" : "success",
        fetched: result.fetched,
        revealed: result.revealed,
        inserted: result.inserted,
        duplicates: result.duplicates,
        noEmail: result.noEmail,
        durationMs: Date.now() - startedAt,
        metadata: {
          list_id: data.listId,
          list_name: data.listName,
          max_leads: data.maxLeads,
          credit_exhausted: creditExhausted,
        },
      });

      return result;
    } catch (err) {
      // Log failure before rethrowing so the UI still surfaces the error.
      const message = err instanceof Error ? err.message : String(err);
      const codeMatch = message.match(/^\[([A-Z_]+)\]/);
      const errorCode = codeMatch?.[1] ?? "UNKNOWN";
      await recordLeadSync({
        organizationId: data.organizationId,
        userId,
        provider: "apollo",
        source: "apollo_list_import",
        status: errorCode === "QUOTA_EXCEEDED" ? "quota_exceeded" : "error",
        durationMs: Date.now() - startedAt,
        errorCode,
        errorMessage: message.slice(0, 500),
        metadata: { list_id: data.listId, list_name: data.listName, max_leads: data.maxLeads },
      });
      throw err;
    }
  });
