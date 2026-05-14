/**
 * Thin wrapper around the Lovable Connector Gateway.
 *
 * The gateway proxies requests to the underlying provider API and refreshes
 * OAuth tokens transparently. We always go through this — never call provider
 * APIs directly.
 *
 * Server-only: relies on process.env. Importing from a client module will
 * succeed (no env access at module level) but calling these helpers in the
 * browser will throw.
 */

const GATEWAY_BASE = "https://connector-gateway.lovable.dev";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(
      `${name} is not configured. Connect this integration in Settings → Integrations.`,
    );
  return v;
}

export interface GatewayCallOptions {
  /** Connector id, e.g. "slack", "gmail", "hubspot". */
  connectorId: string;
  /** Env var name the gateway injects, e.g. "SLACK_API_KEY". */
  envVar: string;
  /** Path under the connector base, e.g. "/api/chat.postMessage". */
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body. Mutually exclusive with formBody. */
  body?: unknown;
  /** application/x-www-form-urlencoded body (some providers like Twilio require this). */
  formBody?: Record<string, string>;
  /** Extra headers to merge in (e.g. Authorization for providers that need a separate user token). */
  headers?: Record<string, string>;
}

export async function callGateway<T = unknown>(opts: GatewayCallOptions): Promise<T> {
  const lovableKey = requireEnv("LOVABLE_API_KEY");
  const connectorKey = requireEnv(opts.envVar);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectorKey,
    ...(opts.headers ?? {}),
  };

  let body: BodyInit | undefined;
  if (opts.formBody) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.formBody).toString();
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const url = `${GATEWAY_BASE}/${opts.connectorId}${opts.path.startsWith("/") ? "" : "/"}${opts.path}`;
  const res = await fetch(url, {
    method: opts.method ?? "POST",
    headers,
    body,
  });

  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // keep as text
  }

  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(
      `${opts.connectorId} gateway call failed [${res.status}]: ${detail.slice(0, 500)}`,
    );
  }

  return data as T;
}

/**
 * Best-effort revoke — tells the gateway to invalidate the OAuth token / cached
 * credentials for this connection. Safe to call even if the connector doesn't
 * implement revoke (we treat 404 / unsupported as success since there's nothing
 * to revoke on our side).
 *
 * The actual underlying connection in the user's workspace is NOT deleted —
 * that's a workspace-level action the user can take from Lovable settings.
 * This call ensures any cached tokens at the gateway layer are dropped so the
 * next call requires re-auth.
 */
export async function revokeConnectorCredentials(
  envVar: string,
): Promise<{ ok: boolean; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectorKey = process.env[envVar];
  if (!lovableKey || !connectorKey) {
    // No credentials present means there's nothing to revoke — treat as success.
    return { ok: true };
  }

  try {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/revoke_credentials`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectorKey,
      },
    });
    // 404 = endpoint not implemented for this connector; 200/204 = revoked.
    if (res.ok || res.status === 404) {
      return { ok: true };
    }
    const text = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

/**
 * Best-effort credentials check — used by the UI to display a "verified" badge
 * without actually performing a destructive action.
 */
export async function verifyConnectorCredentials(
  envVar: string,
): Promise<{ ok: boolean; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectorKey = process.env[envVar];
  if (!lovableKey || !connectorKey) {
    return { ok: false, error: "Missing credentials" };
  }

  try {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/verify_credentials`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectorKey,
      },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { outcome?: string; error?: string };
    if (data.outcome === "verified" || data.outcome === "skipped") {
      return { ok: true };
    }
    return { ok: false, error: data.error ?? data.outcome ?? "unknown" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}
