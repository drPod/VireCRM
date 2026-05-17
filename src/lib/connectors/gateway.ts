/**
 * Connector gateway — Phase 2 stub.
 *
 * Previously a thin wrapper over the Lovable Connector Gateway, which
 * brokered OAuth and proxied calls to Apollo / Slack / Gmail / HubSpot /
 * Twilio / Sendgrid / etc. Lovable is being removed (see Phase 1 migration);
 * the replacement (Nango or hand-rolled OAuth proxy) is deferred to Phase 2.
 *
 * Until that lands, every call path returns a structured "not configured"
 * error instead of crashing the route. UI surfaces show a clean "Connect this
 * integration" prompt rather than a 500.
 *
 * Don't reintroduce the Lovable proxy as a fallback — loud failure is the
 * intentional signal that Phase 2 work is needed.
 */

export interface GatewayCallOptions {
  /** Connector id, e.g. "slack", "gmail", "hubspot". */
  connectorId: string;
  /** Env var name the gateway used to inject, e.g. "SLACK_API_KEY". */
  envVar: string;
  /** Path under the connector base, e.g. "/api/chat.postMessage". */
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  formBody?: Record<string, string>;
  headers?: Record<string, string>;
}

export class ConnectorNotConfiguredError extends Error {
  readonly name = "ConnectorNotConfiguredError";
  readonly status = 503;
  constructor(connectorId: string) {
    super(
      `Connector "${connectorId}" is not configured. Integrations gateway is offline pending Phase 2 OAuth proxy work.`,
    );
  }
}

export async function callGateway<T = unknown>(opts: GatewayCallOptions): Promise<T> {
  throw new ConnectorNotConfiguredError(opts.connectorId);
}

export async function revokeConnectorCredentials(
  _envVar: string,
): Promise<{ ok: boolean; error?: string }> {
  // Nothing to revoke — there is no upstream gateway holding credentials.
  return { ok: true };
}

export async function verifyConnectorCredentials(
  _envVar: string,
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: "connector not configured" };
}
