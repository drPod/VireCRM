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
import { verifyConnectorCredentials, revokeConnectorCredentials } from "@/lib/connectors/gateway";
import { recordConnectorActivity } from "./_connector-log";
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
  config: Record<string, string | number | boolean | null>;
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

    const byId = new Map<string, { enabled: boolean; config: Record<string, string | number | boolean | null>; created_at: string }>();
    for (const r of rows ?? []) {
      byId.set(r.provider, {
        enabled: r.enabled,
        config: ((r.config as Record<string, string | number | boolean | null>) ?? {}),
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

// ----- REFRESH a single connector's status (used by background polling).
// This is intentionally lightweight — it does NOT require owner role (any
// org member can trigger a refresh from the UI), and it performs a live
// gateway verify + (for Gmail) a connected-email discovery, then persists
// any newly-learned config back to org_connectors.
//
// Why this exists: after a user completes the OAuth handshake in a popup,
// the gateway eventually injects the API key as an env var. There's no
// push notification — we have to poll. Returning the fresh ConnectorStatus
// lets the UI swap from "Awaiting auth" → "Connected" without a manual
// page reload.
const refreshSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(VALID_PROVIDERS),
});

/**
 * Best-effort fetch of the Gmail account email associated with the linked
 * connection. Returns null on any failure — the caller treats null as
 * "couldn't discover yet, try again later".
 */
async function fetchGmailConnectedEmail(envVar: string): Promise<string | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectorKey = process.env[envVar];
  if (!lovableKey || !connectorKey) return null;
  try {
    const res = await fetch(
      "https://connector-gateway.lovable.dev/gmail/gmail/v1/users/me/profile",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connectorKey,
        },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { emailAddress?: string };
    return typeof data.emailAddress === "string" ? data.emailAddress : null;
  } catch {
    return null;
  }
}

export const refreshConnectorStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof refreshSchema>) => refreshSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Membership check (not owner-restricted — see comment above).
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profile?.organization_id !== data.organizationId) {
      throw new Error("Not a member of that organization.");
    }

    const meta = getConnector(data.provider);
    if (!meta) throw new Error(`Unknown connector: ${data.provider}`);

    const { data: row } = await supabaseAdmin
      .from("org_connectors")
      .select("provider, enabled, config, created_at")
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider)
      .maybeSingle();

    const credentialPresent = !!process.env[meta.envVar];
    let verified: boolean | null = null;
    let verifyError: string | null = null;
    let config: Record<string, string | number | boolean | null> =
      ((row?.config as Record<string, string | number | boolean | null>) ?? {});

    if (row?.enabled && credentialPresent) {
      const v = await verifyConnectorCredentials(meta.envVar);
      verified = v.ok;
      verifyError = v.ok ? null : v.error ?? null;

      // For Gmail, opportunistically discover and cache the connected
      // mailbox email. Only fetch when we don't already have it, so we
      // don't hammer the gateway on every poll.
      if (v.ok && data.provider === "gmail" && !config.connectedEmail) {
        const email = await fetchGmailConnectedEmail(meta.envVar);
        if (email) {
          const nextConfig = {
            ...config,
            connectedEmail: email,
            // Seed the user-facing "from address" if they haven't set one yet —
            // it's almost always the same as the connected mailbox.
            fromAddress:
              typeof config.fromAddress === "string" && config.fromAddress.length > 0
                ? config.fromAddress
                : email,
          };
          await supabaseAdmin
            .from("org_connectors")
            .update({ config: nextConfig as never })
            .eq("organization_id", data.organizationId)
            .eq("provider", data.provider);
          config = nextConfig;
        }
      }
    }

    const status: ConnectorStatus = {
      id: meta.id,
      enabled: !!row?.enabled,
      credentialPresent,
      verified,
      verifyError,
      config,
      enabledAt: row?.created_at ?? null,
    };
    return { status };
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

    const meta = getConnector(data.provider);
    if (!meta) throw new Error(`Unknown connector: ${data.provider}`);

    // 1. Best-effort revoke against the gateway so cached OAuth tokens are
    //    invalidated. We don't fail the whole disconnect if revoke errors —
    //    the user clearly wants this thing off, and the local state is the
    //    source of truth for whether we'll attempt to use it.
    const revoke = await revokeConnectorCredentials(meta.envVar);

    // 2. Flip enabled=false AND clear cached gateway-derived config (e.g.
    //    connectedEmail, fromAddress, calendar IDs). Owner-set preferences
    //    are stored in the same jsonb but it's safer to wipe them on
    //    disconnect — they'll be re-collected when the user reconnects, and
    //    leaving stale values around (e.g. an old "send from" address) leads
    //    to confusing failures next time.
    const { error } = await supabaseAdmin
      .from("org_connectors")
      .update({ enabled: false, config: {} as never })
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider);
    if (error) throw new Error(`Failed to disable: ${error.message}`);

    // 3. Audit trail.
    await recordConnectorActivity({
      organizationId: data.organizationId,
      userId: context.userId,
      provider: data.provider,
      direction: "outbound",
      action: "disconnect",
      status: revoke.ok ? "success" : "partial",
      summary: revoke.ok
        ? `Disconnected ${meta.name}; gateway credentials revoked.`
        : `Disconnected ${meta.name} locally; gateway revoke failed.`,
      errorMessage: revoke.ok ? null : revoke.error ?? null,
    });

    return {
      ok: true,
      revoked: revoke.ok,
      revokeError: revoke.ok ? null : revoke.error ?? null,
    };
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

// ----- TEST: live verify_credentials ping -----
const testSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(VALID_PROVIDERS),
});

export const testConnectorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof testSchema>) => testSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId, data.organizationId);

    const meta = getConnector(data.provider);
    if (!meta) throw new Error(`Unknown connector: ${data.provider}`);

    if (!process.env[meta.envVar]) {
      return { ok: false as const, reason: "No credentials linked yet. Connect this provider first." };
    }

    const v = await verifyConnectorCredentials(meta.envVar);
    return v.ok
      ? { ok: true as const, verifiedAt: new Date().toISOString() }
      : { ok: false as const, reason: v.error ?? "Verification failed" };
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
          config: ((r.config as Record<string, string | number | boolean | null>) ?? {}),
        })),
    };
  });
