// Client-side auth error utilities for server-function callers.
//
// `SessionExpiredError` — thrown when no Supabase session is present.
// `isAuthError` — best-effort heuristic against errors thrown by server fns
//   guarded by `requireAuth` (matches 401/403 HTTPError + our own class).
// `handleAuthError` — toast + login redirect; safe to call unconditionally
//   in catch blocks (returns false when the error is not auth-related).
// `getServerFnAuthHeaders` — used only by the legacy code path; the new
//   global `attachAuth` middleware attaches the header automatically.
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Thrown when the Supabase session is missing or expired. Callers should
 * surface a friendly "Please sign in again" message — `handleAuthError`
 * already does that automatically.
 */
export class SessionExpiredError extends Error {
  constructor(message = "Your session expired. Please sign in again.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

const SIGN_IN_TOAST_ID = "session-expired";
let lastSignInToastAt = 0;

function showSignInToast(message?: string) {
  // Debounce — multiple parallel server fn calls would otherwise stack toasts.
  const now = Date.now();
  if (now - lastSignInToastAt < 3000) return;
  lastSignInToastAt = now;
  toast.error(message || "Please sign in again", {
    id: SIGN_IN_TOAST_ID,
    description: "Your session expired. Redirecting you to the login page…",
  });
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  // Give the toast a beat to render before the route swap.
  window.setTimeout(() => {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/login?next=${next}`);
  }, 600);
}

/**
 * Returns true when the error looks like an auth failure from a server
 * function call (401/403, "HTTPError", or our own SessionExpiredError).
 */
export function isAuthError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof SessionExpiredError) return true;
  const msg = error instanceof Error ? error.message : String(error);
  if (/session expired|please sign in|not authenticated|unauthor/i.test(msg)) return true;
  // TanStack Start surfaces server-fn HTTP failures as `HTTPError` with a
  // `status` field on the cause / response.
  const anyErr = error as { status?: number; statusCode?: number; cause?: { status?: number } };
  const status = anyErr.status ?? anyErr.statusCode ?? anyErr.cause?.status;
  return status === 401 || status === 403;
}

/**
 * Centralized handler — shows the toast, kicks off a login redirect, and
 * returns `true` when the error was auth-related. Use this in catch blocks
 * around server-fn calls so users never see a generic crash for 401s.
 */
export function handleAuthError(error: unknown): boolean {
  if (!isAuthError(error)) return false;
  showSignInToast();
  redirectToLogin();
  return true;
}

/**
 * Helper retained for the few call sites that explicitly need to read the
 * current Bearer token (e.g. legacy non-serverFn `fetch()` calls). The
 * standard server-function path no longer needs this — `attachAuth` runs
 * automatically as global function middleware.
 */
export async function getServerFnAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    showSignInToast();
    redirectToLogin();
    throw new SessionExpiredError();
  }
  return { Authorization: `Bearer ${token}` };
}
