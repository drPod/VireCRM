// Browser-side Sentry init. RR v7 strips `*.client.ts` from server bundles, so
// importing this from `root.tsx` is safe — it never runs in the Worker.
//
// No-op when `VITE_SENTRY_DSN` is empty (Sentry SDK contract). Local dev and
// preview builds without a DSN provisioned stay silent.
import * as Sentry from "@sentry/react-router";

// `release` is injected at build time by `@sentry/vite-plugin` (sets the
// plugin's release name as a global the SDK auto-reads). No need to pass
// it manually here — VITE_RELEASE was never defined and silently fell back
// to undefined.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // 100% transaction sampling — free-tier 5K events/mo cap; revisit at scale or when Stripe billing lands.
  tracesSampleRate: 1.0,
});

// Re-export so callers in universal modules (e.g. `root.tsx`) don't have to
// import `@sentry/react-router` directly. The named binding is stripped from
// server bundles along with the rest of this file.
export const captureException = Sentry.captureException;
