// Apollo.io REST client — server-side only.
// Docs: https://docs.apollo.io/reference/people-search
//
// We use two endpoints:
//   1. /v1/mixed_people/search — paginated people search by title/industry/etc.
//      Cheap, returns ~25 profiles per page but emails are masked.
//   2. /v1/people/match (per-person) — reveals verified email + phone.
//      Costs 1 credit per call.
//
// Auth: header `X-Api-Key: <key>` (Apollo's master key per workspace).

const APOLLO_BASE = "https://api.apollo.io/api/v1";

export interface ApolloSearchParams {
  /** Free-text persona/title — Apollo matches against `person_titles`. */
  personTitles?: string[];
  /** Industry keywords (Apollo uses ~1.4k taxonomy entries; free-text works too). */
  organizationIndustryTagIds?: string[];
  /** Free-text industry keywords as fallback. */
  qOrganizationKeywordTags?: string[];
  /** Country names, e.g. "united states". */
  personLocations?: string[];
  /** 1-100. */
  perPage?: number;
  /** 1-based. */
  page?: number;
}

export interface ApolloPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string | null;
  /** Apollo returns "email_not_unlocked@domain.com" until you reveal. */
  email_status?: string;
  linkedin_url?: string | null;
  phone_numbers?: Array<{ raw_number?: string; sanitized_number?: string }>;
  organization?: {
    id?: string;
    name?: string;
    website_url?: string;
    primary_domain?: string;
    industry?: string;
    estimated_num_employees?: number;
  };
}

export interface ApolloError extends Error {
  status?: number;
  /** True when the API key is invalid / expired. */
  isAuthError?: boolean;
  /** True when the workspace has no credits left. */
  isCreditError?: boolean;
}

function makeApolloError(message: string, status?: number): ApolloError {
  const err = new Error(message) as ApolloError;
  err.status = status;
  err.isAuthError = status === 401 || status === 403;
  err.isCreditError = status === 402 || /credit/i.test(message);
  return err;
}

/** Lightweight credentials check — calls /auth/health which doesn't burn credits. */
export async function verifyApolloKey(
  apiKey: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${APOLLO_BASE}/auth/health`, {
      method: "GET",
      headers: { "X-Api-Key": apiKey, "Cache-Control": "no-cache" },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "Invalid API key — Apollo rejected it." };
    }
    return { ok: false, reason: `Apollo returned ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Network error" };
  }
}

/** Search Apollo's people database. Does NOT reveal emails (free-ish). */
export async function searchApolloPeople(
  apiKey: string,
  params: ApolloSearchParams,
): Promise<ApolloPerson[]> {
  const body: Record<string, unknown> = {
    page: params.page ?? 1,
    per_page: Math.min(params.perPage ?? 25, 100),
  };
  if (params.personTitles?.length) body.person_titles = params.personTitles;
  if (params.qOrganizationKeywordTags?.length) {
    body.q_organization_keyword_tags = params.qOrganizationKeywordTags;
  }
  if (params.personLocations?.length) body.person_locations = params.personLocations;

  const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw makeApolloError(
      `Apollo search failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  const data = (await res.json()) as { people?: ApolloPerson[]; contacts?: ApolloPerson[] };
  // Apollo returns matches in either `people` (cold prospects) or `contacts`
  // (already-saved). We merge both.
  return [...(data.people ?? []), ...(data.contacts ?? [])];
}

/**
 * Reveal a verified email for a single person. Burns 1 Apollo email credit.
 * Returns null if Apollo can't find a verified address.
 */
export async function revealApolloEmail(
  apiKey: string,
  person: ApolloPerson,
): Promise<{ email: string | null; phone: string | null }> {
  const body: Record<string, unknown> = {
    reveal_personal_emails: true,
    reveal_phone_number: false, // phone is much pricier — opt-in later if needed
  };

  // Match by Apollo person ID when available — most reliable.
  if (person.id) {
    body.id = person.id;
  } else {
    // Fallback to name + company.
    if (person.first_name) body.first_name = person.first_name;
    if (person.last_name) body.last_name = person.last_name;
    if (person.organization?.name) body.organization_name = person.organization.name;
    if (person.organization?.primary_domain) body.domain = person.organization.primary_domain;
  }

  const res = await fetch(`${APOLLO_BASE}/people/match`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw makeApolloError(
      `Apollo reveal failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  const data = (await res.json()) as { person?: ApolloPerson };
  const matched = data.person;
  if (!matched) return { email: null, phone: null };

  const email =
    matched.email && matched.email !== "email_not_unlocked@domain.com" ? matched.email : null;
  const phone = matched.phone_numbers?.[0]?.sanitized_number ?? null;
  return { email, phone };
}

// ===== Saved-list endpoints =====
// Apollo's saved-list feature lives under /v1/labels (lists are "labels" in their API).
// To pull members of a list we filter people search by `label_ids`.

export interface ApolloList {
  id: string;
  name: string;
  /** Apollo doesn't always return a count; we treat undefined as "unknown". */
  cached_count?: number;
  created_at?: string;
  modality?: string; // "contacts" | "accounts" — we only care about contacts
}

/** Fetch all saved lists (labels) on the workspace. Free, no credits burned. */
export async function listApolloLists(apiKey: string): Promise<ApolloList[]> {
  const res = await fetch(`${APOLLO_BASE}/labels`, {
    method: "GET",
    headers: { "X-Api-Key": apiKey, "Cache-Control": "no-cache" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw makeApolloError(
      `Apollo list fetch failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }
  const data = (await res.json()) as { labels?: ApolloList[] };
  // Filter to contact-type labels only (skip account lists which can't produce people)
  return (data.labels ?? []).filter((l) => !l.modality || l.modality === "contacts");
}

/**
 * Fetch contacts saved in a specific list. Paginated — Apollo caps per_page at 100.
 * Does NOT reveal emails (use revealApolloEmail per-person for that).
 */
export async function getApolloListMembers(
  apiKey: string,
  labelId: string,
  opts: { page?: number; perPage?: number } = {},
): Promise<{ people: ApolloPerson[]; totalEntries: number; totalPages: number }> {
  const body = {
    label_ids: [labelId],
    page: opts.page ?? 1,
    per_page: Math.min(opts.perPage ?? 100, 100),
  };

  const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw makeApolloError(
      `Apollo list members fetch failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  const data = (await res.json()) as {
    people?: ApolloPerson[];
    contacts?: ApolloPerson[];
    pagination?: { total_entries?: number; total_pages?: number };
  };
  return {
    people: [...(data.people ?? []), ...(data.contacts ?? [])],
    totalEntries: data.pagination?.total_entries ?? 0,
    totalPages: data.pagination?.total_pages ?? 1,
  };
}
