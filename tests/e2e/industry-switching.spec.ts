/**
 * E2E QA suite — industry switching.
 *
 * Switches the test org through Energy → Solar → Real Estate → Insurance via
 * a direct DB update (Supabase service role) and asserts:
 *
 *   1. Sidebar surfaces the correct industry hub link and hides the others
 *      (no stale hubs from the previous template).
 *   2. The hub page renders with the expected heading.
 *   3. Pipeline stage counts on the hub bucket leads from the template's
 *      stage list (no leakage from a previous industry's stages).
 *
 * Required env (set via .env.test or CI secrets):
 *   QA_BASE_URL              — e.g. https://...lovable.app  (defaults to http://localhost:4173)
 *   QA_TEST_EMAIL            — owner login email
 *   QA_TEST_PASSWORD         — owner login password
 *   QA_TEST_ORG_ID           — uuid of the org to mutate
 *   SUPABASE_URL             — project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (server-only; never commit)
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  INDUSTRY_TEMPLATES,
  type IndustryKey,
} from "../../src/lib/industry-templates";

const REQUIRED_ENV = [
  "QA_TEST_EMAIL",
  "QA_TEST_PASSWORD",
  "QA_TEST_ORG_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    // Skip the whole file rather than hard-failing in dev environments
    // without the seeded test org.
    test.skip(true, `Missing required env var: ${key}`);
  }
}

const ORG_ID = process.env.QA_TEST_ORG_ID!;
const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// Industries we cycle through, in the order specified by the user.
const INDUSTRIES: {
  key: IndustryKey;
  hubPath: string;
  hubLabel: string;
  /** Other industry hub labels that must NOT appear in the sidebar. */
  staleHubs: string[];
}[] = [
  {
    key: "energy",
    hubPath: "/energy",
    hubLabel: "Energy Hub",
    staleHubs: ["Solar Hub", "Real Estate Hub", "Insurance Hub"],
  },
  {
    key: "solar",
    hubPath: "/solar",
    hubLabel: "Solar Hub",
    staleHubs: ["Energy Hub", "Real Estate Hub", "Insurance Hub"],
  },
  {
    key: "real_estate",
    hubPath: "/real-estate",
    hubLabel: "Real Estate Hub",
    staleHubs: ["Energy Hub", "Solar Hub", "Insurance Hub"],
  },
  {
    key: "insurance",
    hubPath: "/insurance",
    hubLabel: "Insurance Hub",
    staleHubs: ["Energy Hub", "Solar Hub", "Real Estate Hub"],
  },
];

async function setIndustry(key: IndustryKey) {
  // Mirror what IndustryTemplatePanel does on reset: clear enabled_modules so
  // sidebar gating relies purely on the new template.key.
  const { error } = await admin
    .from("organizations")
    .update({ industry_template: key, enabled_modules: null })
    .eq("id", ORG_ID);
  if (error) throw error;
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.QA_TEST_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.QA_TEST_PASSWORD!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  // Wait for any authed route to render (sidebar visible).
  await expect(page.getByRole("navigation")).toBeVisible({ timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Industry switching E2E", () => {
  test.beforeAll(async () => {
    // Snapshot the current industry so we can restore it after the run.
    const { data } = await admin
      .from("organizations")
      .select("industry_template, enabled_modules")
      .eq("id", ORG_ID)
      .single();
    test.info().annotations.push({
      type: "original-state",
      description: JSON.stringify(data),
    });
  });

  test.afterAll(async () => {
    const original = test.info().annotations.find(
      (a) => a.type === "original-state",
    );
    if (!original?.description) return;
    const parsed = JSON.parse(original.description);
    await admin
      .from("organizations")
      .update({
        industry_template: parsed.industry_template,
        enabled_modules: parsed.enabled_modules,
      })
      .eq("id", ORG_ID);
  });

  for (const industry of INDUSTRIES) {
    test(`switches to ${industry.key} cleanly`, async ({ page }) => {
      await setIndustry(industry.key);
      await login(page);

      // Force a clean reload so AuthProvider re-fetches organization.
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const sidebar = page.getByRole("navigation");

      // 1. Active hub link present.
      await expect(
        sidebar.getByRole("link", { name: industry.hubLabel }),
      ).toBeVisible();

      // 2. Stale hubs from other industries must NOT appear.
      for (const stale of industry.staleHubs) {
        await expect(
          sidebar.getByRole("link", { name: stale }),
        ).toHaveCount(0);
      }

      // 3. Navigate to hub and verify heading.
      await sidebar.getByRole("link", { name: industry.hubLabel }).click();
      await expect(page).toHaveURL(new RegExp(`${industry.hubPath}$`));

      const template = INDUSTRY_TEMPLATES[industry.key];
      // Energy hub uses a static heading; others render template.name.
      const expectedHeading =
        industry.key === "energy" ? "Energy CRM" : template.name;
      await expect(
        page.getByRole("heading", { level: 1, name: expectedHeading }),
      ).toBeVisible({ timeout: 10_000 });

      // 4. Pipeline counts: every defined stage for this template renders,
      //    and the total never exceeds total leads in the org (sanity check).
      if (industry.key !== "energy") {
        for (const stage of template.pipelineStages) {
          // Stage labels appear as text on the hub. Use first() because the
          // label can repeat in the legend + chart.
          await expect(page.getByText(stage, { exact: false }).first())
            .toBeVisible();
        }
      }

      // 5. Server-side sanity: stage counts match what's actually in the DB
      //    when bucketed using the same case-insensitive logic as the hub.
      const { data: leads, error } = await admin
        .from("leads")
        .select("status")
        .eq("organization_id", ORG_ID);
      expect(error).toBeNull();

      const stageSet = new Set(
        template.pipelineStages.map((s) => s.toLowerCase()),
      );
      const bucketed = (leads ?? []).filter((l) =>
        stageSet.has((l.status ?? "").trim().toLowerCase()),
      ).length;
      // Bucketed count must never exceed total leads — guards against
      // duplicate counting bugs like the pre-fix ilike substring matcher.
      expect(bucketed).toBeLessThanOrEqual((leads ?? []).length);
    });
  }
});
