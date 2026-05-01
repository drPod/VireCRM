/**
 * Regression tests for the pure stage-bucketing logic.
 *
 * These specifically guard against the two production bugs we hit:
 *   1. Substring matching ("New Lead" vs "Newest")
 *   2. Cross-org leakage — even though scoping happens at the query layer,
 *      we test that bucketing of a mixed-org dataset only ever counts what
 *      it was given, and never silently expands its input.
 */
import { describe, it, expect } from "vitest";
import { bucketLeadsByStage, type LeadStatusRow } from "../pipeline-counts";

const SOLAR_STAGES = [
  "New Lead",
  "Site Survey",
  "Proposal",
  "Contract Signed",
  "Installed",
  "Lost",
];

describe("bucketLeadsByStage", () => {
  it("buckets exact, case-insensitive matches", () => {
    const rows: LeadStatusRow[] = [
      { status: "New Lead" },
      { status: "new lead" },
      { status: "  PROPOSAL  " },
      { status: "Lost" },
    ];
    const { counts, unmapped } = bucketLeadsByStage(rows, SOLAR_STAGES);
    expect(counts["New Lead"]).toBe(2);
    expect(counts["Proposal"]).toBe(1);
    expect(counts["Lost"]).toBe(1);
    expect(unmapped).toBe(0);
  });

  it("does NOT match substrings (regression: 'New Lead' vs 'Newest')", () => {
    const rows: LeadStatusRow[] = [
      { status: "Newest" },
      { status: "New Lead Pending" },
      { status: "ProposalDraft" },
    ];
    const { counts, unmapped } = bucketLeadsByStage(rows, SOLAR_STAGES);
    // None of these are exact matches — should all be unmapped.
    expect(counts["New Lead"]).toBe(0);
    expect(counts["Proposal"]).toBe(0);
    expect(unmapped).toBe(3);
  });

  it("ignores empty/null statuses without inflating any bucket", () => {
    const rows: LeadStatusRow[] = [
      { status: null },
      { status: "" },
      { status: "   " },
      { status: "New Lead" },
    ];
    const { counts, unmapped } = bucketLeadsByStage(rows, SOLAR_STAGES);
    expect(counts["New Lead"]).toBe(1);
    expect(unmapped).toBe(0);
    // Sum of all buckets must equal counted leads (1), never the input length (4).
    const total = Object.values(counts).reduce((a, b) => a + b, 0) + unmapped;
    expect(total).toBe(1);
  });

  it("never produces a bucketed total greater than input length", () => {
    // Property-style check: even with wildly varied data, no double-counting.
    const rows: LeadStatusRow[] = Array.from({ length: 200 }, (_, i) => ({
      status: i % 3 === 0 ? "New Lead" : i % 3 === 1 ? "Proposal" : "Junk",
    }));
    const { counts, unmapped } = bucketLeadsByStage(rows, SOLAR_STAGES);
    const total = Object.values(counts).reduce((a, b) => a + b, 0) + unmapped;
    expect(total).toBe(rows.length);
  });

  it("only counts rows it was given (no cross-org leakage at the bucketing layer)", () => {
    // Simulate what the DB layer should have already filtered: only org A's rows.
    const orgA = "org-aaa";
    const orgB = "org-bbb";
    const allRows: LeadStatusRow[] = [
      { status: "New Lead", organization_id: orgA },
      { status: "Proposal", organization_id: orgA },
      // These would only be present if org_id scoping was missing on the
      // query — bucketing must never see them.
      { status: "New Lead", organization_id: orgB },
      { status: "Lost", organization_id: orgB },
    ];
    const orgARows = allRows.filter((r) => r.organization_id === orgA);
    const { counts } = bucketLeadsByStage(orgARows, SOLAR_STAGES);
    expect(counts["New Lead"]).toBe(1);
    expect(counts["Proposal"]).toBe(1);
    expect(counts["Lost"]).toBe(0);
  });
});
