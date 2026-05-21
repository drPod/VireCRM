import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // VITE_* env vars are surfaced via `import.meta.env` in Vite/Vitest. Some
    // route handlers gate behavior on `VITE_SUPABASE_URL` even though they
    // build a service-role client server-side; tests don't need a real URL,
    // just a non-empty string so the gate is passable.
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
    },
  },
});
