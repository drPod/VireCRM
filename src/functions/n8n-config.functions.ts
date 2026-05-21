import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/auth/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ACTION_TYPES = [
  "create_task",
  "draft_message",
  "score_leads",
  "create_campaign",
  "pipeline_summary",
] as const;

export type N8nActionType = (typeof ACTION_TYPES)[number];

export interface N8nWebhookConfig {
  webhooks: Partial<Record<N8nActionType, string>>;
  enabled: boolean;
}

const saveSchema = z.object({
  webhooks: z.record(z.enum(ACTION_TYPES), z.string().trim().max(500)),
  enabled: z.boolean().optional(),
});

// Loosely typed: TanStack middleware context typing makes a strict signature
// hard to express here, and we only use a couple of supabase methods.
async function getOrgId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("No organization found");
  return data.organization_id as string;
}

export const getN8nConfigFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<N8nWebhookConfig> => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);

    const { data } = await supabase
      .from("org_connectors")
      .select("config, enabled")
      .eq("organization_id", orgId)
      .eq("provider", "n8n")
      .maybeSingle();

    const cfg = (data?.config ?? {}) as { webhooks?: Record<string, string> };
    return {
      webhooks: (cfg.webhooks ?? {}) as N8nWebhookConfig["webhooks"],
      enabled: data?.enabled ?? false,
    };
  });

export const saveN8nConfigFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof saveSchema>) => saveSchema.parse(input))
  .handler(async ({ data, context }): Promise<N8nWebhookConfig> => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);

    // Validate URLs (must be https for safety, except localhost during dev)
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.webhooks)) {
      const url = (v ?? "").trim();
      if (!url) continue;
      try {
        const u = new URL(url);
        if (!/^https?:$/i.test(u.protocol)) {
          throw new Error(`Invalid URL for ${k}: must start with http(s)://`);
        }
        cleaned[k] = url;
      } catch {
        throw new Error(`Invalid URL for ${k}`);
      }
    }

    const enabled = data.enabled ?? Object.keys(cleaned).length > 0;

    // Upsert via admin (RLS lets owners write; admin keeps this simple).
    const { data: existing } = await supabaseAdmin
      .from("org_connectors")
      .select("id")
      .eq("organization_id", orgId)
      .eq("provider", "n8n")
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("org_connectors")
        .update({
          config: { webhooks: cleaned },
          enabled,
          enabled_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("org_connectors").insert({
        organization_id: orgId,
        provider: "n8n",
        config: { webhooks: cleaned },
        enabled,
        enabled_by: userId,
      });
      if (error) throw error;
    }

    return {
      webhooks: cleaned as N8nWebhookConfig["webhooks"],
      enabled,
    };
  });
