// Hunter.io REST client — server-side only.
// Docs: https://hunter.io/api-documentation/v2
//
// We use three endpoints:
//   1. /v2/account             — credit/quota check (used by verifyHunterKey).
//   2. /v2/domain-search       — list verified emails for a given company domain.
//                                Each returned email costs ~1 request credit.
//   3. /v2/email-finder        — find a specific person's email by name+domain
//                                (1 credit). Not used in the main flow but kept
//                                as a helper for future enrichment features.
//
// Auth: query string `?api_key=<key>`.

const HUNTER_BASE = "https://api.hunter.io/v2";

export interface HunterError extends Error {
  status?: number;
  isAuthError?: boolean;
  isCreditError?: boolean;
}

function makeHunterError(message: string, status?: number): HunterError {
  const err = new Error(message) as HunterError;
  err.status = status;
  err.isAuthError = status === 401 || status === 403;
  err.isCreditError = status === 402 || status === 429 || /credit|quota/i.test(message);
  return err;
}

export async function verifyHunterKey(
  apiKey: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${HUNTER_BASE}/account?api_key=${encodeURIComponent(apiKey)}`, {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "Invalid API key — Hunter rejected it." };
    }
    return { ok: false, reason: `Hunter returned ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Network error" };
  }
}

export interface HunterEmail {
  value: string;
  type?: string; // "personal" | "generic"
  confidence?: number; // 0-100
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  seniority?: string | null;
  department?: string | null;
  linkedin?: string | null;
  phone_number?: string | null;
}

export interface HunterDomainSearchResult {
  domain: string;
  organization?: string;
  industry?: string | null;
  emails: HunterEmail[];
}

/**
 * Find verified emails at a company domain. Hunter's bread-and-butter — much
 * cheaper per credit than Apollo's per-person reveal.
 */
export async function searchHunterDomain(
  apiKey: string,
  opts: {
    domain: string;
    /** Filter to a specific job title (free text). */
    seniority?: "junior" | "senior" | "executive";
    department?: string;
    /** 1-100. Hunter caps at 100 per request. */
    limit?: number;
  },
): Promise<HunterDomainSearchResult> {
  const params = new URLSearchParams({
    api_key: apiKey,
    domain: opts.domain,
    limit: String(Math.min(opts.limit ?? 25, 100)),
  });
  if (opts.seniority) params.set("seniority", opts.seniority);
  if (opts.department) params.set("department", opts.department);

  const res = await fetch(`${HUNTER_BASE}/domain-search?${params.toString()}`, {
    method: "GET",
    headers: { "Cache-Control": "no-cache" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw makeHunterError(
      `Hunter domain-search failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  const json = (await res.json()) as {
    data?: {
      domain?: string;
      organization?: string;
      industry?: string | null;
      emails?: HunterEmail[];
    };
  };
  return {
    domain: json.data?.domain ?? opts.domain,
    organization: json.data?.organization,
    industry: json.data?.industry,
    emails: json.data?.emails ?? [],
  };
}

/** Find a specific person's email by name + domain. 1 credit. */
export async function findHunterEmail(
  apiKey: string,
  opts: { domain: string; firstName: string; lastName: string },
): Promise<{ email: string | null; confidence: number | null }> {
  const params = new URLSearchParams({
    api_key: apiKey,
    domain: opts.domain,
    first_name: opts.firstName,
    last_name: opts.lastName,
  });

  const res = await fetch(`${HUNTER_BASE}/email-finder?${params.toString()}`, {
    method: "GET",
    headers: { "Cache-Control": "no-cache" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw makeHunterError(
      `Hunter email-finder failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  const json = (await res.json()) as {
    data?: { email?: string | null; score?: number | null };
  };
  return {
    email: json.data?.email ?? null,
    confidence: json.data?.score ?? null,
  };
}
