// Owner-only server functions for managing per-org integration credentials
// (Apollo, Hunter, Snov, SendGrid). Keys are stored in `org_integrations` and
// never returned to the client raw — the UI only sees a masked preview, the
// last verified timestamp, and any non-secret config (e.g. SendGrid's default
// "from" address).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyApolloKey } from "@/lib/apollo";
import { verifyHunterKey } from "@/lib/hunter";
import { verifySnovKey } from "@/lib/snov";
import { verifySendgridKey } from "@/lib/sendgrid";
import { z } from "zod";

const SUPPORTED_PROVIDERS = ["apollo", "hunter", "snov", "sendgrid"] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

async function verifyKey(provider: Provider, key: string) {
  switch (provider) {
    case "apollo":
      return verifyApolloKey(key);
    case "hunter":
      return verifyHunterKey(key);
    case "snov":
      return verifySnovKey(key);
    case "sendgrid":
      return verifySendgridKey(key);
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

async function assertOwner(userId: string, organizationId: string) {
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .maybeSingle();
  if (!roleRow) throw new Error("Only the organization owner can manage integrations.");
}

// ----- GET integration status (no raw key) -----
const getSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(SUPPORTED_PROVIDERS),
});

export const getIntegrationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof getSchema>) => getSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.organizationId);

    const { data: row } = await supabaseAdmin
      .from("org_integrations")
      .select("api_key, last_verified_at, updated_at, config")
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider)
      .maybeSingle();

    if (!row) return { configured: false as const };
    const cfg = (row.config ?? {}) as Record<string, string | number | boolean | null>;
    return {
      configured: true as const,
      maskedKey: maskKey(row.api_key),
      lastVerifiedAt: row.last_verified_at,
      updatedAt: row.updated_at,
      config: cfg,
    };
  });

// ----- SAVE / UPDATE -----
const saveSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(SUPPORTED_PROVIDERS),
  apiKey: z.string().trim().min(10).max(500),
});

export const saveIntegrationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof saveSchema>) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.organizationId);

    // Verify the key works BEFORE persisting — saves us from storing garbage.
    const verify = await verifyKey(data.provider, data.apiKey);
    if (!verify.ok) {
      throw new Error(verify.reason);
    }

    const { error } = await supabaseAdmin.from("org_integrations").upsert(
      {
        organization_id: data.organizationId,
        provider: data.provider,
        api_key: data.apiKey,
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    );

    if (error) throw new Error(`Failed to save: ${error.message}`);
    return { success: true, maskedKey: maskKey(data.apiKey) };
  });

// ----- UPDATE just the non-secret config (e.g. SendGrid default from address) -----
const updateConfigSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(SUPPORTED_PROVIDERS),
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export const updateIntegrationConfigFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof updateConfigSchema>) => updateConfigSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.organizationId);

    const { error } = await supabaseAdmin
      .from("org_integrations")
      .update({ config: data.config as never })
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider);

    if (error) throw new Error(`Failed to update settings: ${error.message}`);
    return { success: true };
  });

// ----- TEST: re-verify the stored key against the provider -----
const testSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(SUPPORTED_PROVIDERS),
});

export const testIntegrationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof testSchema>) => testSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.organizationId);

    const { data: row } = await supabaseAdmin
      .from("org_integrations")
      .select("api_key")
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider)
      .maybeSingle();

    if (!row) {
      return { ok: false as const, reason: "Not configured" };
    }

    const verify = await verifyKey(data.provider, row.api_key);
    if (verify.ok) {
      await supabaseAdmin
        .from("org_integrations")
        .update({ last_verified_at: new Date().toISOString() })
        .eq("organization_id", data.organizationId)
        .eq("provider", data.provider);
      return { ok: true as const, verifiedAt: new Date().toISOString() };
    }
    return { ok: false as const, reason: verify.reason };
  });

// ----- DELETE -----
const deleteSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(SUPPORTED_PROVIDERS),
});

export const deleteIntegrationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof deleteSchema>) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.organizationId);

    const { error } = await supabaseAdmin
      .from("org_integrations")
      .delete()
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider);

    if (error) throw new Error(`Failed to remove: ${error.message}`);
    return { success: true };
  });
