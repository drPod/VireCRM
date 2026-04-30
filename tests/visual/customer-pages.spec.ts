import { test, expect, devices } from "@playwright/test";

/**
 * Visual + smoke regression for customer-facing pages.
 *
 * - Smoke: page loads, no console errors, no horizontal scroll.
 * - Visual: full-page screenshot diffed against committed baseline.
 *
 * Update baselines with:  bun run test:visual:update
 */

const PUBLIC_ROUTES = [
  { name: "home", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "auth", path: "/auth" },
  { name: "reset-password", path: "/reset-password" },
  { name: "unsubscribe", path: "/unsubscribe" },
];

// Reseller + booking need a real slug from seed data. Override via env.
const RESELLER_SLUG = process.env.QA_RESELLER_SLUG ?? "demo";
const BOOKING_SLUG = process.env.QA_BOOKING_SLUG ?? "demo";

const SLUG_ROUTES = [
  { name: "book", path: `/book/${BOOKING_SLUG}` },
  { name: "reseller-home", path: `/r/${RESELLER_SLUG}` },
  { name: "reseller-signup", path: `/r/${RESELLER_SLUG}/signup` },
];

const VIEWPORTS = [
  { name: "mobile", ...devices["iPhone 13"].viewport! },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const ALL_ROUTES = [...PUBLIC_ROUTES, ...SLUG_ROUTES];

for (const vp of VIEWPORTS) {
  test.describe(`@${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ALL_ROUTES) {
      test(`${route.name} — smoke + visual`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        const resp = await page.goto(route.path, { waitUntil: "networkidle" });
        expect(resp?.status(), `HTTP status for ${route.path}`).toBeLessThan(400);

        // No horizontal overflow
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, "horizontal overflow (px)").toBeLessThanOrEqual(2);

        // Heading present
        await expect(page.locator("h1, h2").first()).toBeVisible();

        // No noisy console errors (allowlist common dev warnings)
        const meaningful = consoleErrors.filter(
          (e) => !/favicon|hydration mismatch \(text\)|DevTools/.test(e),
        );
        expect(meaningful, `console errors on ${route.path}`).toEqual([]);

        // Visual snapshot
        await expect(page).toHaveScreenshot(`${route.name}-${vp.name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.02,
          animations: "disabled",
        });
      });
    }
  });
}
