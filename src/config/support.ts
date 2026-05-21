/**
 * Single source of truth for the Majix business / support email.
 *
 * Use this everywhere user-facing UI, error fallbacks, and contact-related
 * routes need to surface a way to reach us. Reseller / white-label flows
 * still use the per-organization `support_email` column — this constant is
 * the VireCRM-brand fallback only.
 */
export const SUPPORT_EMAIL = "darsh.pod@gmail.com";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}` as const;
export const SUPPORT_PHONE = "(540) 244-1130";
export const SUPPORT_PHONE_E164 = "+15402441130";
