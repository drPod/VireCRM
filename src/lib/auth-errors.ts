/**
 * Map raw Supabase auth error messages to friendly, actionable copy.
 * Keeps error feedback consistent across login / signup / reset flows.
 */
export function friendlyAuthError(err: unknown, fallback = "Something went wrong"): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = raw.toLowerCase();

  if (!msg) return fallback;

  if (msg.includes("invalid login") || msg.includes("invalid_credentials") || msg.includes("invalid email or password")) {
    return "That email and password don't match. Double-check or reset your password.";
  }
  if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
    return "Please confirm your email first — check your inbox for the verification link.";
  }
  if (msg.includes("user already registered") || msg.includes("already registered") || msg.includes("user_already_exists")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (msg.includes("user not found")) {
    return "We couldn't find an account with that email.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("over_email_send_rate_limit")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (msg.includes("password should be") || msg.includes("weak_password")) {
    return "That password is too weak — try a longer phrase or add numbers and symbols.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Network issue. Check your connection and try again.";
  }
  if (msg.includes("expired") && msg.includes("link")) {
    return "This link has expired. Please request a new one.";
  }
  if (msg.includes("token has expired") || msg.includes("invalid token") || msg.includes("otp_expired")) {
    return "This link is invalid or has expired. Please request a new one.";
  }

  return raw || fallback;
}
