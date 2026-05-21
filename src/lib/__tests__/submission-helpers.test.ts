/**
 * Pin-down tests for the pure helpers extracted from the original
 * 1.2k-line `ContactSubmissionsPanel.tsx`. The refactor moved this logic
 * unchanged; these tests guard against drift across future cleanups.
 */
import { describe, it, expect } from "vitest";

import type { AdminSubmissionRow } from "@/types/admin";
import {
  buildInvoiceMailto,
  statusVariant,
  suggestAmount,
  suggestPlanForSubmission,
} from "../submission-helpers";

const baseSubmission: AdminSubmissionRow = {
  id: "sub_1",
  name: "Jane Doe",
  email: "jane@example.com",
  company: "Acme",
  phone: null,
  project_type: null,
  budget: null,
  message: "hello",
  status: "new",
  origin: null,
  test_mode: false,
  sentiment: null,
  topic: null,
  intent_summary: null,
  priority_suggestion: null,
  metadata: null,
  created_at: "2026-05-22T00:00:00Z",
  replied_at: null,
};

describe("statusVariant", () => {
  it("maps Stripe invoice statuses to badge variants", () => {
    expect(statusVariant("paid")).toBe("default");
    expect(statusVariant("void")).toBe("destructive");
    expect(statusVariant("uncollectible")).toBe("destructive");
    expect(statusVariant("open")).toBe("secondary");
    expect(statusVariant("sent")).toBe("secondary");
    expect(statusVariant("finalized")).toBe("secondary");
    expect(statusVariant("draft")).toBe("outline");
    expect(statusVariant("unknown")).toBe("outline");
  });
});

describe("buildInvoiceMailto", () => {
  it("builds a mailto URL with encoded subject + body", () => {
    const href = buildInvoiceMailto({
      ...baseSubmission,
      project_type: "Custom CRM build",
      budget: "$5,000",
    });
    expect(href.startsWith("mailto:jane@example.com?")).toBe(true);
    const decoded = decodeURIComponent(href);
    expect(decoded).toContain("VireCRM — Invoice for your Custom CRM build");
    expect(decoded).toContain("Hi Jane");
    expect(decoded).toContain("$5,000 budget");
    expect(decoded).toContain("— Ethan, VireCRM");
  });

  it("falls back to 'project' when project_type is null", () => {
    const href = buildInvoiceMailto({ ...baseSubmission, project_type: null });
    expect(decodeURIComponent(href)).toContain("Invoice for your project");
  });
});

describe("suggestPlanForSubmission", () => {
  it("prefers an explicit interested_plan in metadata", () => {
    const out = suggestPlanForSubmission({
      ...baseSubmission,
      metadata: { interested_plan: "growth" },
    });
    expect(out?.plan.value).toBe("growth");
    expect(out?.source).toBe("interested_plan");
  });

  it("normalizes full-ownership aliases", () => {
    const out = suggestPlanForSubmission({
      ...baseSubmission,
      metadata: { plan: "Full Ownership" },
    });
    expect(out?.plan.value).toBe("full_ownership");
    expect(out?.source).toBe("interested_plan");
  });

  it("falls back to budget matching", () => {
    const out = suggestPlanForSubmission({
      ...baseSubmission,
      budget: "$5,000",
    });
    expect(out?.plan.value).toBe("growth");
    expect(out?.source).toBe("budget");
  });

  it("falls back to project_type signal when budget is empty", () => {
    const out = suggestPlanForSubmission({
      ...baseSubmission,
      project_type: "Custom Enterprise",
    });
    expect(out?.plan.value).toBe("enterprise");
    expect(out?.source).toBe("project_type");
  });

  it("returns null when no signal matches", () => {
    expect(suggestPlanForSubmission(baseSubmission)).toBeNull();
  });
});

describe("suggestAmount", () => {
  it("uses the suggested plan total when one matches", () => {
    const out = suggestAmount({ ...baseSubmission, budget: "$5,000" });
    expect(out).not.toBe("");
    expect(Number.parseFloat(out)).toBeGreaterThan(0);
  });

  it("returns empty string when no plan and no budget hint", () => {
    expect(suggestAmount(baseSubmission)).toBe("");
  });
});
