/**
 * E2E QA suite — energy vertical smoke.
 *
 * Replaces the previous industry-switching cycle test (Energy → Solar → Real
 * Estate → Insurance). Energy is the only vertical now; non-energy hubs were
 * dropped from the sidebar + routes.
 *
 * What this test guards:
 *   1. The 7 energy sidebar links render (Energy Hub + 6 sub-items).
 *   2. The stripped non-energy hub labels do NOT appear in the sidebar.
 *   3. The vertical "lock" icon (previously surfaced muted non-active hubs) is
 *      gone — there's nothing to lock.
 *   4. Every energy route returns 200 and renders an `<h1>`.
 *
 * Required env (set via .env.test or CI secrets):
 *   QA_BASE_URL              — e.g. http://localhost:4173 or staging URL
 *   QA_TEST_EMAIL            — owner login email
 *   QA_TEST_PASSWORD         — owner login password
 *
 * The file skips itself if any required env var is missing so CI without
 * secrets passes gracefully (same pattern as the deleted spec).
 */
import { test, expect, type Page } from "@playwright/test";

const REQUIRED_ENV = ["QA_TEST_EMAIL", "QA_TEST_PASSWORD"] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    test.skip(true, `Missing required env var: ${key}`);
  }
}

// Sidebar items the new single-vertical layout must surface, in order.
const ENERGY_SIDEBAR_ITEMS = [
  "Energy Hub",
  "LOAs",
  "Usage",
  "Pricing",
  "Contracts",
  "Suppliers",
  "Renewals",
] as const;

// Removed-vertical labels that must NOT appear anywhere in the sidebar.
const STRIPPED_HUB_LABELS = [
  "Solar Hub",
  "Solar Projects",
  "Real Estate Hub",
  "Listings",
  "Showings",
  "Insurance Hub",
  "Quotes",
  "Policies",
  "Member Health",
] as const;

// Routes every energy install must successfully render.
const ENERGY_ROUTES: { path: string; label: string }[] = [
  { path: "/energy", label: "Energy Hub" },
  { path: "/energy/loa", label: "LOAs" },
  { path: "/energy/usage", label: "Usage" },
  { path: "/energy/pricing", label: "Pricing" },
  { path: "/energy/contracts", label: "Contracts" },
  { path: "/energy/suppliers", label: "Suppliers" },
  { path: "/energy/renewals", label: "Renewals" },
  { path: "/energy/customers", label: "Customers" },
];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.QA_TEST_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.QA_TEST_PASSWORD!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  // Wait for any authed route to render (sidebar visible).
  await expect(page.getByRole("navigation")).toBeVisible({ timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Energy vertical smoke", () => {
  test("sidebar surfaces all 7 energy links and none of the stripped hubs", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const sidebar = page.getByRole("navigation");

    for (const label of ENERGY_SIDEBAR_ITEMS) {
      await expect(sidebar.getByRole("link", { name: label })).toBeVisible();
    }

    for (const stale of STRIPPED_HUB_LABELS) {
      await expect(sidebar.getByRole("link", { name: stale })).toHaveCount(0);
    }
  });

  test("no vertical lock icon renders — single-vertical layout", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // The locked-vertical UI marked muted items with aria-disabled="true".
    // Energy is the only vertical so nothing should be flagged disabled.
    const sidebar = page.getByRole("navigation");
    await expect(sidebar.locator('[aria-disabled="true"]')).toHaveCount(0);
  });

  for (const route of ENERGY_ROUTES) {
    test(`${route.path} renders with an <h1>`, async ({ page }) => {
      await login(page);
      const response = await page.goto(route.path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
    });
  }
});
