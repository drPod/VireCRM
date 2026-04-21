// Owner-only server functions for managing per-org integration credentials
// (currently just Apollo.io). Keys are stored in `org_integrations` and never
// returned to the client raw — the UI only sees a masked preview + verified state.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyApolloKey } from "@/lib/apollo";
import { verifyHunterKey } from "@/lib/hunter";
import { verifySnovKey } from "@/lib/snov";
import { z } from "zod";

const SUPPORTED_PROVIDERS = ["apollo", "hunter", "snov"] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

async function verifyKey(provider: Provider, key: string) {
  switch (provider) {
    case "apollo":
      return verifyApolloKey(key);
    case "hunter":
      return verifyHunterKey(key);
    case "snov":
      return verifySnovKey(key);
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
      .select("api_key, last_verified_at, updated_at")
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider)
      .maybeSingle();

    if (!row) return { configured: false as const };
    return {
      configured: true as const,
      maskedKey: maskKey(row.api_key),
      lastVerifiedAt: row.last_verified_at,
      updatedAt: row.updated_at,
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
    const verify = await verifyApolloKey(data.apiKey);
    if (!verify.ok) {
      throw new Error(verify.reason);
    }

    const { error } = await supabaseAdmin
      .from("org_integrations")
      .upsert(
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
