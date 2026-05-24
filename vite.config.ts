import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  build: { sourcemap: "hidden" },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    // Plugin no-ops when any required Sentry env var is absent (local dev, PR CI without secrets).
    ...(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
              filesToDeleteAfterUpload: ["./build/client/**/*.map", "./build/server/**/*.map"],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
