/**
 * Server functions for managing the org's enabled connectors.
 *
 * Connectors are different from BYO API keys (Apollo / Hunter / Snov):
 *   - Tokens are managed by the Lovable Connector Gateway, not stored in DB.
 *   - We only track which providers the org has *enabled* + per-provider config.
 *   - The `verifyConnectorCredentials` helper does a live check against the
 *     gateway so the UI can show "Verified" without performing real actions.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CONNECTORS, getConnector } from "@/lib/connectors/catalog";
import { verifyConnectorCredentials } from "@/lib/connectors/gateway";
import { z } from "zod";

const VALID_PROVIDERS = CONNECTORS.map((c) => c.id) as [string, ...string[]];

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

// ----- LIST: returns one row per catalog entry with enabled/verified state -----
const listSchema = z.object({ organizationId: z.string().uuid() });

export interface ConnectorStatus {
  id: string;
  enabled: boolean;
  /** True only if the underlying gateway secret is also present in the runtime env. */
  credentialPresent: boolean;
  /** Result of a live verify_credentials ping (only populated when enabled). */
  verified: boolean | null;
  verifyError: string | null;
  config: Record<string, unknown>;
  enabledAt: string | null;
}

export const listConnectorsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof listSchema>) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId, data.organizationId);

    const { data: rows } = await supabaseAdmin
      .from("org_connectors")
      .select("provider, enabled, config, created_at")
      .eq("organization_id", data.organizationId);

    const byId = new Map<string, { enabled: boolean; config: Record<string, unknown>; created_at: string }>();
    for (const r of rows ?? []) {
      byId.set(r.provider, {
        enabled: r.enabled,
        config: (r.config as Record<string, unknown>) ?? {},
        created_at: r.created_at,
      });
    }

    const statuses: ConnectorStatus[] = await Promise.all(
      CONNECTORS.map(async (c) => {
        const row = byId.get(c.id);
        const credentialPresent = !!process.env[c.envVar];
        let verified: boolean | null = null;
        let verifyError: string | null = null;

        if (row?.enabled && credentialPresent) {
          const v = await verifyConnectorCredentials(c.envVar);
          verified = v.ok;
          verifyError = v.ok ? null : v.error ?? null;
        }

        return {
          id: c.id,
          enabled: !!row?.enabled,
          credentialPresent,
          verified,
          verifyError,
          config: row?.config ?? {},
          enabledAt: row?.created_at ?? null,
        };
      }),
    );

    return { statuses };
  });

// ----- ENABLE / UPSERT -----
const enableSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(VALID_PROVIDERS),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const enableConnectorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof enableSchema>) => enableSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId, data.organizationId);

    const meta = getConnector(data.provider);
    if (!meta) throw new Error(`Unknown connector: ${data.provider}`);

    const { error } = await supabaseAdmin
      .from("org_connectors")
      .upsert(
        {
          organization_id: data.organizationId,
          provider: data.provider,
          enabled: true,
          enabled_by: context.userId,
          config: (data.config ?? {}) as never,
        },
        { onConflict: "organization_id,provider" },
      );
    if (error) throw new Error(`Failed to enable: ${error.message}`);

    return { ok: true, credentialPresent: !!process.env[meta.envVar] };
  });

// ----- DISABLE -----
const disableSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(VALID_PROVIDERS),
});

export const disableConnectorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof disableSchema>) => disableSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId, data.organizationId);

    const { error } = await supabaseAdmin
      .from("org_connectors")
      .update({ enabled: false })
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider);
    if (error) throw new Error(`Failed to disable: ${error.message}`);
    return { ok: true };
  });

// ----- UPDATE CONFIG (default channel, mailbox, team id, etc.) -----
const configSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(VALID_PROVIDERS),
  config: z.record(z.string(), z.unknown()),
});

export const updateConnectorConfigFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof configSchema>) => configSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId, data.organizationId);

    const { error } = await supabaseAdmin
      .from("org_connectors")
      .update({ config: data.config as never })
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider);
    if (error) throw new Error(`Failed to update: ${error.message}`);
    return { ok: true };
  });

// ----- LIST ENABLED connectors (no owner check — used by the lead drawer) -----
const enabledSchema = z.object({ organizationId: z.string().uuid() });

export const listEnabledConnectorsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof enabledSchema>) => enabledSchema.parse(input))
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

    const { data: rows } = await supabaseAdmin
      .from("org_connectors")
      .select("provider, config")
      .eq("organization_id", data.organizationId)
      .eq("enabled", true);

    return {
      enabled: (rows ?? [])
        .filter((r) => !!process.env[getConnector(r.provider)?.envVar ?? ""])
        .map((r) => ({
          provider: r.provider,
          config: (r.config as Record<string, unknown>) ?? {},
        })),
    };
  });
