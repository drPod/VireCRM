// Snov.io REST client — server-side only.
// Docs: https://snov.io/api
//
// Snov uses an OAuth2 client_credentials flow. The "API key" stored in
// org_integrations is actually a `client_id:client_secret` pair (single string,
// colon-separated) entered by the user. We exchange it for a short-lived bearer
// token on every server call — Snov tokens expire after 1h so caching across
// requests isn't worth the complexity here.
//
// We use three endpoints:
//   1. /v1/oauth/access_token        — exchange credentials for bearer token.
//   2. /v2/domain-emails-with-info   — list emails for a company domain
//                                      (much cheaper than Apollo per-person).
//   3. /v1/get-emails-from-names     — find email by first/last + domain.

const SNOV_BASE = "https://api.snov.io";

export interface SnovError extends Error {
  status?: number;
  isAuthError?: boolean;
  isCreditError?: boolean;
}

function makeSnovError(message: string, status?: number): SnovError {
  const err = new Error(message) as SnovError;
  err.status = status;
  err.isAuthError = status === 401 || status === 403;
  err.isCreditError = status === 402 || status === 429 || /credit|limit|balance/i.test(message);
  return err;
}

function parseSnovKey(rawKey: string): { clientId: string; clientSecret: string } {
  const [clientId, clientSecret] = rawKey.split(":");
  if (!clientId || !clientSecret) {
    throw makeSnovError(
      "Snov key must be in 'client_id:client_secret' format (paste both values from snov.io/api joined with a colon).",
      400,
    );
  }
  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
}

async function getSnovAccessToken(rawKey: string): Promise<string> {
  const { clientId, clientSecret } = parseSnovKey(rawKey);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${SNOV_BASE}/v1/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw makeSnovError(`Snov auth failed (${res.status}): ${text.slice(0, 200)}`, res.status);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw makeSnovError("Snov did not return an access token", 401);
  }
  return json.access_token;
}

export async function verifySnovKey(
  apiKey: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await getSnovAccessToken(apiKey);
    return { ok: true };
  } catch (err) {
    const e = err as SnovError;
    if (e.isAuthError) return { ok: false, reason: "Snov rejected your client_id/client_secret." };
    return { ok: false, reason: e.message || "Snov key verification failed" };
  }
}

export interface SnovEmail {
  email: string;
  type?: string; // "personal" | "generic"
  status?: string; // "valid" | "unknown" | etc.
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  sourcePage?: string | null;
}

export interface SnovDomainSearchResult {
  domain: string;
  companyName?: string;
  emails: SnovEmail[];
}

/** Find emails at a company domain. */
export async function searchSnovDomain(
  apiKey: string,
  opts: {
    domain: string;
    /** Snov caps limit at 100 per call. */
    limit?: number;
    /** "personal" returns only personal emails (skip generic info@/sales@). */
    type?: "all" | "personal" | "generic";
  },
): Promise<SnovDomainSearchResult> {
  const token = await getSnovAccessToken(apiKey);
  const params = new URLSearchParams({
    access_token: token,
    domain: opts.domain,
    type: opts.type ?? "personal",
    limit: String(Math.min(opts.limit ?? 25, 100)),
    lastId: "0",
  });

  const res = await fetch(`${SNOV_BASE}/v2/domain-emails-with-info?${params.toString()}`, {
    method: "GET",
    headers: { "Cache-Control": "no-cache" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw makeSnovError(
      `Snov domain-search failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  const json = (await res.json()) as {
    domain?: string;
    companyName?: string;
    emails?: Array<{
      email?: string;
      type?: string;
      status?: string;
      firstName?: string | null;
      lastName?: string | null;
      position?: string | null;
      sourcePage?: string | null;
    }>;
  };

  const emails: SnovEmail[] = (json.emails ?? [])
    .filter((e): e is { email: string } & typeof e => !!e.email)
    .map((e) => ({
      email: e.email,
      type: e.type,
      status: e.status,
      firstName: e.firstName ?? null,
      lastName: e.lastName ?? null,
      position: e.position ?? null,
      sourcePage: e.sourcePage ?? null,
    }));

  return {
    domain: json.domain ?? opts.domain,
    companyName: json.companyName,
    emails,
  };
}
