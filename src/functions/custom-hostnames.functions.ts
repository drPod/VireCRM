/**
 * Cloudflare for SaaS custom-hostname provisioning.
 *
 * Calls the CF REST API (no in-Worker binding exists for custom hostnames)
 * to:
 *   - provision: POST /zones/{zone_id}/custom_hostnames
 *   - poll:      GET  /zones/{zone_id}/custom_hostnames/{id}
 *   - teardown:  DELETE /zones/{zone_id}/custom_hostnames/{id}
 *
 * Gated behind CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID. When either is
 * missing, every fn throws a 503 Response with body "CF for SaaS not
 * configured" — callers can detect that and degrade gracefully (toast
 * + best-effort persist). See docs/custom-domains/cf-for-saas-setup.md
 * for the operator-side runbook.
 *
 * Storage:
 *   - We persist only the CF-issued `id` (cf_hostname_id) on either the
 *     org_custom_domains row (multi-domain panel) or the organizations row
 *     (single-domain fallback). Validation records (TXT for ownership +
 *     SSL DCV) are NOT mirrored — CF is source of truth, re-fetch on demand.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/auth/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertOrgMember } from "@/lib/auth-helpers";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * One TXT validation record CF wants in the customer's DNS (either for
 * ownership verification or for SSL DCV). Surfaced verbatim to the
 * customer-facing onboarding UI.
 */
export interface CfTxtRecord {
  name: string;
  value: string;
}

export interface CustomHostnameSnapshot {
  cfHostnameId: string;
  hostname: string;
  // CF custom hostname status: "pending" | "active" | "active_redeploying" |
  // "blocked" | "moved" | "deleted" | "deactivated" | "pending_blocked" |
  // "pending_migration" | "pending_deletion" | "test_pending" | "test_active"
  // | "test_active_apex" | "test_blocked" | "test_failed" — surface the raw
  // string to the UI which renders friendly badges.
  status: string;
  sslStatus: string | null;
  // App-level ownership verification (CF "_cf-custom-hostname.<host>" style).
  ownershipVerification: CfTxtRecord | null;
  // Per-cert DCV TXT records the customer must add for the SSL cert to issue.
  sslValidationRecords: CfTxtRecord[];
}

interface CfApiError {
  code: number;
  message: string;
}

interface CfApiEnvelope<T> {
  success: boolean;
  result: T;
  errors: CfApiError[];
  messages: CfApiError[];
}

interface CfCustomHostnameResponse {
  id: string;
  hostname: string;
  status: string;
  ownership_verification?: {
    type?: string;
    name?: string;
    value?: string;
  };
  ssl?: {
    status?: string;
    validation_records?: Array<{
      txt_name?: string;
      txt_value?: string;
    }>;
  };
}

function readCfEnv(): { token: string; zoneId: string } | null {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) return null;
  return { token, zoneId };
}

// TanStack Start serializes thrown Error.message + Error.name across the wire
// but turns thrown Response into a generic 500 "HTTPError" envelope on the
// client — so we use a discriminator on Error instead. The exact message
// string is the wire contract; the matching detector lives in
// `src/lib/cf-saas-errors.ts`.
export const CF_NOT_CONFIGURED_MESSAGE = "CF for SaaS not configured";

function notConfiguredError(): Error {
  const err = new Error(CF_NOT_CONFIGURED_MESSAGE);
  err.name = "CfNotConfiguredError";
  return err;
}

async function cfFetch<T>(
  path: string,
  init: RequestInit,
  token: string,
): Promise<CfApiEnvelope<T>> {
  const res = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  // CF returns JSON for both 2xx and 4xx — only network failures throw above.
  const json = (await res.json().catch(() => null)) as CfApiEnvelope<T> | null;
  if (!json) {
    throw new Error(`Cloudflare API returned non-JSON (status ${res.status})`);
  }
  return json;
}

function snapshotFromCf(payload: CfCustomHostnameResponse): CustomHostnameSnapshot {
  const ov =
    payload.ownership_verification?.name && payload.ownership_verification?.value
      ? {
          name: payload.ownership_verification.name,
          value: payload.ownership_verification.value,
        }
      : null;

  const sslRecords = (payload.ssl?.validation_records ?? [])
    .filter((r) => !!r.txt_name && !!r.txt_value)
    .map((r) => ({ name: r.txt_name as string, value: r.txt_value as string }));

  return {
    cfHostnameId: payload.id,
    hostname: payload.hostname,
    status: payload.status,
    sslStatus: payload.ssl?.status ?? null,
    ownershipVerification: ov,
    sslValidationRecords: sslRecords,
  };
}

/**
 * Find the row that should carry the cf_hostname_id for this (org, hostname)
 * pair. Prefers the org_custom_domains row (canonical multi-domain table);
 * falls back to organizations.custom_domain (single-domain fallback).
 *
 * Returns null when no matching row exists — caller should reject up front
 * rather than provision a hostname we can't attribute later.
 */
async function locateStorage(
  organizationId: string,
  hostname: string,
): Promise<
  { table: "org_custom_domains"; id: string } | { table: "organizations"; id: string } | null
> {
  const lower = hostname.toLowerCase();

  const { data: domainRow } = await supabaseAdmin
    .from("org_custom_domains")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("hostname", lower)
    .maybeSingle();
  if (domainRow) {
    return { table: "org_custom_domains", id: domainRow.id };
  }

  const { data: orgRow } = await supabaseAdmin
    .from("organizations")
    .select("id, custom_domain")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgRow && (orgRow.custom_domain ?? "").toLowerCase() === lower) {
    return { table: "organizations", id: orgRow.id };
  }
  return null;
}

async function persistCfHostnameId(
  storage: { table: "org_custom_domains" | "organizations"; id: string },
  cfHostnameId: string | null,
): Promise<void> {
  // Casting through the union manually because supabaseAdmin's typed update
  // call requires a literal table name to narrow the row type.
  if (storage.table === "org_custom_domains") {
    const { error } = await supabaseAdmin
      .from("org_custom_domains")
      .update({ cf_hostname_id: cfHostnameId })
      .eq("id", storage.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ cf_hostname_id: cfHostnameId })
      .eq("id", storage.id);
    if (error) throw new Error(error.message);
  }
}

const hostnameSchema = z
  .string()
  .min(3)
  .max(253)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i)
  .transform((s) => s.trim().toLowerCase());

const provisionSchema = z.object({
  organizationId: z.string().uuid(),
  hostname: hostnameSchema,
});

const lookupSchema = z.object({
  organizationId: z.string().uuid(),
  hostname: hostnameSchema,
});

/**
 * Provision a custom hostname against the configured CF zone. Idempotent —
 * if the storage row already carries a `cf_hostname_id`, we poll that
 * existing record instead of creating a duplicate.
 *
 * Required permissions on the CF API token: `Zone → SSL and Certificates → Edit`
 * scoped to the configured zone.
 */
export const provisionCustomHostnameFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof provisionSchema>) => provisionSchema.parse(input))
  .handler(async ({ data, context }): Promise<CustomHostnameSnapshot> => {
    const env = readCfEnv();
    if (!env) throw notConfiguredError();

    await assertOrgMember(supabaseAdmin, context.userId, data.organizationId);

    const storage = await locateStorage(data.organizationId, data.hostname);
    if (!storage) {
      throw new Error(
        "No matching custom-domain row for this org+hostname — save the domain first.",
      );
    }

    // If we've already provisioned this hostname, poll instead of duplicating.
    const existingId = await readExistingCfHostnameId(storage);
    if (existingId) {
      const poll = await cfFetch<CfCustomHostnameResponse>(
        `/zones/${env.zoneId}/custom_hostnames/${existingId}`,
        { method: "GET" },
        env.token,
      );
      if (poll.success) return snapshotFromCf(poll.result);
      // Stale id (e.g. deleted on CF side) — fall through to re-provision.
    }

    const created = await cfFetch<CfCustomHostnameResponse>(
      `/zones/${env.zoneId}/custom_hostnames`,
      {
        method: "POST",
        body: JSON.stringify({
          hostname: data.hostname,
          ssl: { method: "txt", type: "dv" },
        }),
      },
      env.token,
    );
    if (!created.success) {
      const msg = created.errors?.[0]?.message ?? "Cloudflare rejected the request";
      throw new Error(msg);
    }

    await persistCfHostnameId(storage, created.result.id);
    return snapshotFromCf(created.result);
  });

async function readExistingCfHostnameId(storage: {
  table: "org_custom_domains" | "organizations";
  id: string;
}): Promise<string | null> {
  if (storage.table === "org_custom_domains") {
    const { data } = await supabaseAdmin
      .from("org_custom_domains")
      .select("cf_hostname_id")
      .eq("id", storage.id)
      .maybeSingle();
    return data?.cf_hostname_id ?? null;
  }
  const { data } = await supabaseAdmin
    .from("organizations")
    .select("cf_hostname_id")
    .eq("id", storage.id)
    .maybeSingle();
  return data?.cf_hostname_id ?? null;
}

/**
 * Poll CF for the current status of a hostname (verification + SSL). Used
 * by DomainHealthPanel to render "Verifying / Setting up SSL / Active"
 * badges. Returns null when we've never provisioned this hostname.
 */
export const pollCustomHostnameStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof lookupSchema>) => lookupSchema.parse(input))
  .handler(async ({ data, context }): Promise<CustomHostnameSnapshot | null> => {
    const env = readCfEnv();
    if (!env) throw notConfiguredError();

    await assertOrgMember(supabaseAdmin, context.userId, data.organizationId);

    const storage = await locateStorage(data.organizationId, data.hostname);
    if (!storage) return null;

    const cfHostnameId = await readExistingCfHostnameId(storage);
    if (!cfHostnameId) return null;

    const poll = await cfFetch<CfCustomHostnameResponse>(
      `/zones/${env.zoneId}/custom_hostnames/${cfHostnameId}`,
      { method: "GET" },
      env.token,
    );
    if (!poll.success) {
      const code = poll.errors?.[0]?.code;
      // 1436 = "custom hostname not found" — treat as a cleared id so the
      // caller can re-provision instead of looping on the stale id.
      if (code === 1436) {
        await persistCfHostnameId(storage, null);
        return null;
      }
      const msg = poll.errors?.[0]?.message ?? "Cloudflare poll failed";
      throw new Error(msg);
    }
    return snapshotFromCf(poll.result);
  });

/**
 * Tear down a CF custom hostname when the customer clears their domain.
 * Idempotent — succeeds even if the id is already missing on CF (1436)
 * or was never provisioned to begin with.
 */
export const tearDownCustomHostnameFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof lookupSchema>) => lookupSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const env = readCfEnv();
    if (!env) throw notConfiguredError();

    await assertOrgMember(supabaseAdmin, context.userId, data.organizationId);

    const storage = await locateStorage(data.organizationId, data.hostname);
    if (!storage) return { ok: true };

    const cfHostnameId = await readExistingCfHostnameId(storage);
    if (!cfHostnameId) return { ok: true };

    const del = await cfFetch<{ id: string }>(
      `/zones/${env.zoneId}/custom_hostnames/${cfHostnameId}`,
      { method: "DELETE" },
      env.token,
    );
    // 1436 (not found) is fine — already gone on CF side.
    if (!del.success && del.errors?.[0]?.code !== 1436) {
      const msg = del.errors?.[0]?.message ?? "Cloudflare teardown failed";
      throw new Error(msg);
    }

    await persistCfHostnameId(storage, null);
    return { ok: true };
  });
