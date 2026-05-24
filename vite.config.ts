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
    // Source-map upload (see `.env.example` for `SENTRY_ORG`/`SENTRY_PROJECT`/
    // `SENTRY_AUTH_TOKEN`). Plugin no-ops when token absent → local dev + PR
    // CI without secret still build clean. Plugin also injects the release
    // identifier as a global the SDK auto-reads.
    ...(process.env.SENTRY_AUTH_TOKEN
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
