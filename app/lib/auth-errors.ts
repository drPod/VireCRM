// Pure classifiers used by the login flow. No React, no DOM, no Supabase
// runtime imports — keeps these unit-testable in the Workers vitest pool and
// trivially tree-shakeable.
//
// Two responsibilities:
//   1. `classifySignInError` — collapse Supabase auth errors to a user-safe
//      message + retain the original error for ops logging. Never echo the
//      raw Supabase string: "Invalid login credentials" vs "Email not
//      confirmed" vs rate-limit messages let an attacker enumerate which
//      emails exist on the tenant. Collapse credential-class errors to one
//      generic copy.
//   2. `messageForTenantError` — translate Worker error codes returned from
//      the post-sign-in `/api/auth/whoami` probe into user-facing copy. Don't
//      echo claim values or tenant slugs (denies subdomain probing).

/** Subset of the Supabase `AuthError` shape we actually read. Structural so
 * tests can construct one without the SDK. */
export interface SignInErrorLike {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

export interface ClassifiedSignInError {
  /** Safe to render in the form's error region. */
  userMessage: string;
  /** Original error preserved verbatim for Sentry. Never rendered. */
  opsError: unknown;
}

const GENERIC_CREDENTIAL_MESSAGE = "Invalid email or password.";
const GENERIC_FALLBACK_MESSAGE = "Sign-in failed. Please try again.";
const RATE_LIMIT_MESSAGE =
  "Too many sign-in attempts. Please wait a moment and try again.";
const NETWORK_MESSAGE =
  "Couldn't reach the sign-in service. Check your connection.";

/**
 * Map an error from `supabase.auth.signInWithPassword` (or its thrown
 * equivalent) to safe user copy + a payload to send to Sentry.
 *
 * Behaviour priority:
 *   1. `invalid_credentials` / `email_not_confirmed` → collapse to one
 *      generic credential message (deny-enumeration).
 *   2. `over_request_rate_limit` / HTTP 429 → distinct rate-limit copy
 *      (no enumeration risk: tells attacker only that *somebody* tried
 *      recently, not whether the email exists).
 *   3. Network/`TypeError` with no `code` → distinct network copy.
 *   4. Everything else → generic fallback.
 */
export function classifySignInError(err: unknown): ClassifiedSignInError {
  const opsError = err;

  if (isLikeAuthError(err)) {
    const code = err.code?.toLowerCase();
    const msg = err.message?.toLowerCase() ?? "";

    if (
      code === "invalid_credentials" ||
      code === "email_not_confirmed" ||
      code === "invalid_grant" ||
      /invalid login credentials/.test(msg) ||
      /email not confirmed/.test(msg)
    ) {
      return { userMessage: GENERIC_CREDENTIAL_MESSAGE, opsError };
    }

    if (
      err.status === 429 ||
      code === "over_request_rate_limit" ||
      code === "over_email_send_rate_limit" ||
      /too many requests/.test(msg) ||
      /rate limit/.test(msg)
    ) {
      return { userMessage: RATE_LIMIT_MESSAGE, opsError };
    }
  }

  if (isNetworkError(err)) {
    return { userMessage: NETWORK_MESSAGE, opsError };
  }

  return { userMessage: GENERIC_FALLBACK_MESSAGE, opsError };
}

/**
 * Translate a Worker error code (returned in `{ error: { code } }` from
 * the post-login `/api/auth/whoami` probe) into user copy. Used after
 * `signInWithPassword` succeeded but the JWT doesn't match the request
 * host / role context.
 *
 * Copy intentionally vague on TENANT_UNKNOWN / TENANT_SCOPE_INVALID — those
 * are bad-URL cases that shouldn't disclose anything about workspace
 * existence to an unauthenticated probe.
 */
export function messageForTenantError(code: string | undefined): string {
  switch (code) {
    case "TENANT_MISMATCH":
      return "This account belongs to a different workspace. Sign in at the correct URL.";
    case "CUSTOMER_PORTAL_NOT_ALLOWED":
      return "This is a customer account. Sign in at customers.virecrm.com.";
    case "TENANT_CLAIM_MISSING":
      return "Your account isn't assigned to a workspace yet. Contact your administrator.";
    case "TENANT_UNKNOWN":
    case "TENANT_SCOPE_INVALID":
      return "This workspace URL isn't recognized.";
    default:
      return GENERIC_FALLBACK_MESSAGE;
  }
}

function isLikeAuthError(err: unknown): err is SignInErrorLike {
  return (
    typeof err === "object" &&
    err !== null &&
    ("code" in err || "status" in err || "message" in err)
  );
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "TypeError" && /fetch/i.test(err.message)) return true;
  if (err.name === "AbortError") return true;
  return false;
}
