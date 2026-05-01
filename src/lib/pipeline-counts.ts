/**
 * Pure helpers for bucketing leads into pipeline stages.
 *
 * Extracted so the bucketing logic can be regression-tested in isolation,
 * independent of React/Supabase. Two prior bugs motivated this:
 *   1. ilike("status","%new lead%") matched any status containing "new",
 *      so "New Lead" and a custom "Newest" both incremented the same row.
 *   2. The DB query wasn't scoped to the active organization, so RLS-allowed
 *      reads from other orgs in the same auth context inflated counts.
 *
 * `bucketLeadsByStage` is pure given an array of rows. The query that
 * produces those rows MUST filter `.eq("organization_id", orgId)` — see the
 * regression tests in src/lib/__tests__/pipeline-counts.test.ts and
 * src/lib/__tests__/pipeline-org-scoping.test.ts.
 */

export interface LeadStatusRow {
  status: string | null;
  /**
   * Optional — only present when callers select organization_id for
   * defensive filtering. Used by `assertOrgScoped` in tests.
   */
  organization_id?: string | null;
}

export interface BucketedCounts {
  /** Map of stage label → number of leads on that exact stage. */
  counts: Record<string, number>;
  /** Leads with a non-empty status that is NOT in the template's stages. */
  unmapped: number;
}

/**
 * Bucket lead rows into the supplied pipeline stages.
 *
 * Matching rules:
 *  - case-insensitive
 *  - whitespace-trimmed
 *  - EXACT label match (no substring matching — that was bug #1)
 */
export function bucketLeadsByStage(
  rows: readonly LeadStatusRow[],
  stages: readonly string[],
): BucketedCounts {
  const counts: Record<string, number> = Object.fromEntries(
    stages.map((s) => [s, 0]),
  );
  const stageSet = new Set(stages.map((s) => s.toLowerCase()));
  let unmapped = 0;

  for (const row of rows) {
    const status = (row.status ?? "").trim();
    if (!status) continue;
    const normalized = status.toLowerCase();
    const match = stages.find((s) => s.toLowerCase() === normalized);
    if (match) {
      counts[match] += 1;
    } else if (!stageSet.has(normalized)) {
      unmapped += 1;
    }
  }

  return { counts, unmapped };
}
