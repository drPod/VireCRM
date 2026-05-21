// Client-side auth middleware. Attaches `Authorization: Bearer <jwt>` to
// every server-function call so the server-side `requireAuth` middleware
// can read it. Registered as a global `functionMiddleware` in
// `src/start.ts` — do NOT import the singleton anywhere else.
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    // SSR guard — `supabase.auth.getSession()` reads from browser storage
    // and breaks if the worker tries to call it during server-side render.
    // No token to attach in SSR anyway; the request will be re-issued from
    // the hydrated client.
    if (typeof window === "undefined") {
      return next({});
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);

// Canonical name. Old `attachSupabaseAuth` kept for back-compat shims.
export const attachAuth = attachSupabaseAuth;
