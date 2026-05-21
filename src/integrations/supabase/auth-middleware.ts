// Back-compat shim. Canonical home: `@/auth/server`.
// Middleware identity must be preserved for `subscription-middleware.ts`
// chain (`.middleware([requireSupabaseAuth, ...])`) — never re-wrap.
export { requireSupabaseAuth, requireAuth } from "@/auth/server";
