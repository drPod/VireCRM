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

    const byId = new Map<
      string,
      {
        enabled: boolean;
        config: Record<string, string | number | boolean | null>;
        created_at: string;
      }
    >();
    for (const r of rows ?? []) {
      byId.set(r.provider, {
        enabled: r.enabled,
        config: (r.config as Record<string, string | number | boolean | null>) ?? {},
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
          verifyError = v.ok ? null : (v.error ?? null);
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

// Best-effort lookup of the connected Google account email for Gmail /
// Google Calendar connectors. Previously routed via the Lovable connector
// gateway; that path was removed in Phase 1. Returns null until Phase 2
// reintroduces a connector OAuth proxy (Nango or hand-rolled) — at which
// point this should hit the new proxy's userinfo endpoint.
// TODO(connectors-phase-2): wire to the new OAuth proxy.
async function fetchGoogleConnectedEmail(
  _provider: "gmail" | "google_calendar",
  _envVar: string,
): Promise<string | null> {
  return null;
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
      (row?.config as Record<string, string | number | boolean | null>) ?? {};

    if (row?.enabled && credentialPresent) {
      const v = await verifyConnectorCredentials(meta.envVar);
      verified = v.ok;
      verifyError = v.ok ? null : (v.error ?? null);

      // For Google connectors, opportunistically discover and cache the
      // connected account email. Only fetch when we don't already have it,
      // so we don't hammer the gateway on every poll.
      if (
        v.ok &&
        (data.provider === "gmail" || data.provider === "google_calendar") &&
        !config.connectedEmail
      ) {
        const email = await fetchGoogleConnectedEmail(data.provider, meta.envVar);
        if (email) {
          const nextConfig: Record<string, string | number | boolean | null> = {
            ...config,
            connectedEmail: email,
          };
          // Gmail-only: seed the user-facing "from address" if they haven't
          // set one yet — it's almost always the same as the connected
          // mailbox. Calendar has no equivalent field.
          if (
            data.provider === "gmail" &&
            !(typeof config.fromAddress === "string" && config.fromAddress.length > 0)
          ) {
            nextConfig.fromAddress = email;
          }
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

    // Detect whether this is a fresh connect or a re-enable so the activity
    // log is more informative ("Connected" vs "Re-enabled").
    const { data: existing } = await supabaseAdmin
      .from("org_connectors")
      .select("enabled")
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider)
      .maybeSingle();
    const isReEnable = !!existing && existing.enabled === false;

    const { error } = await supabaseAdmin.from("org_connectors").upsert(
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

    const credentialPresent = !!process.env[meta.envVar];

    // Audit trail.
    await recordConnectorActivity({
      organizationId: data.organizationId,
      userId: context.userId,
      provider: data.provider,
      direction: "outbound",
      action: isReEnable ? "reconnect" : "connect",
      status: "success",
      summary: credentialPresent
        ? `${isReEnable ? "Re-enabled" : "Enabled"} ${meta.name}; gateway credentials present.`
        : `${isReEnable ? "Re-enabled" : "Enabled"} ${meta.name}; awaiting OAuth handshake.`,
    });

    return { ok: true, credentialPresent };
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
      errorMessage: revoke.ok ? null : (revoke.error ?? null),
    });

    return {
      ok: true,
      revoked: revoke.ok,
      revokeError: revoke.ok ? null : (revoke.error ?? null),
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

    const meta = getConnector(data.provider);

    const { error } = await supabaseAdmin
      .from("org_connectors")
      .update({ config: data.config as never })
      .eq("organization_id", data.organizationId)
      .eq("provider", data.provider);
    if (error) throw new Error(`Failed to update: ${error.message}`);

    // Surface which keys changed (not values — they may contain emails or
    // channel IDs the user wouldn't want pasted into a log line).
    const changedKeys = Object.keys(data.config);
    await recordConnectorActivity({
      organizationId: data.organizationId,
      userId: context.userId,
      provider: data.provider,
      direction: "outbound",
      action: "config_update",
      status: "success",
      summary:
        changedKeys.length > 0
          ? `Updated ${meta?.name ?? data.provider} settings (${changedKeys.join(", ")}).`
          : `Updated ${meta?.name ?? data.provider} settings.`,
      payload: { fields: changedKeys },
    });

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
      const reason = "No credentials linked yet. Connect this provider first.";
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        provider: data.provider,
        direction: "outbound",
        action: "test",
        status: "failed",
        summary: `Test for ${meta.name} skipped — credentials missing.`,
        errorMessage: reason,
      });
      return { ok: false as const, reason };
    }

    const v = await verifyConnectorCredentials(meta.envVar);
    if (v.ok) {
      const verifiedAt = new Date().toISOString();
      await recordConnectorActivity({
        organizationId: data.organizationId,
        userId: context.userId,
        provider: data.provider,
        direction: "outbound",
        action: "test",
        status: "success",
        summary: `Verified ${meta.name} credentials.`,
      });
      return { ok: true as const, verifiedAt };
    }
    const reason = v.error ?? "Verification failed";
    await recordConnectorActivity({
      organizationId: data.organizationId,
      userId: context.userId,
      provider: data.provider,
      direction: "outbound",
      action: "test",
      status: "failed",
      summary: `${meta.name} verify failed.`,
      errorMessage: reason,
    });
    return { ok: false as const, reason };
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
          config: (r.config as Record<string, string | number | boolean | null>) ?? {},
        })),
    };
  });

// ----- LIST ACTIVITY: paginated audit feed for the Integrations → Activity tab.
// Membership-checked (any org member can read) so non-owner reps can see what
// outbound actions ran on their behalf without bothering an owner.
const activitySchema = z.object({
  organizationId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional(),
});

export interface ConnectorActivityEntry {
  id: string;
  provider: string;
  direction: "outbound" | "inbound";
  action: string;
  status: "success" | "failed" | "partial";
  summary: string | null;
  errorMessage: string | null;
  createdAt: string;
  /** Display name of whoever triggered the action, when available. */
  actorName: string | null;
}

export const listConnectorActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof activitySchema>) => activitySchema.parse(input))
  .handler(async ({ data, context }) => {
    // Membership check (org member, not just owner).
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profile?.organization_id !== data.organizationId) {
      throw new Error("Not a member of that organization.");
    }

    const limit = data.limit ?? 50;

    const { data: rows, error } = await supabaseAdmin
      .from("connector_activity_log")
      .select(
        "id, provider, direction, action, status, summary, error_message, created_at, user_id",
      )
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to load activity: ${error.message}`);

    const userIds = Array.from(
      new Set((rows ?? []).map((r) => r.user_id).filter((u): u is string => !!u)),
    );
    const nameByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      for (const p of profiles ?? []) {
        if (p.full_name) nameByUserId.set(p.user_id, p.full_name);
      }
    }

    const entries: ConnectorActivityEntry[] = (rows ?? []).map((r) => ({
      id: r.id,
      provider: r.provider,
      direction: (r.direction as "outbound" | "inbound") ?? "outbound",
      action: r.action,
      status: (r.status as "success" | "failed" | "partial") ?? "success",
      summary: r.summary,
      errorMessage: r.error_message,
      createdAt: r.created_at,
      actorName: r.user_id ? (nameByUserId.get(r.user_id) ?? null) : null,
    }));

    return { entries };
  });
