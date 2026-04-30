import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.QA_PORT ?? 4173);
const BASE_URL = process.env.QA_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      // Anti-aliasing tolerance — keeps diffs meaningful without false positives.
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
  },
  // Spin up the built preview server unless one is already running.
  webServer: process.env.QA_BASE_URL
    ? undefined
    : {
        command: `bun run preview --port ${PORT}`,
        port: PORT,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
