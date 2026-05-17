/**
 * Single source of truth for the Genesis business / support email.
 *
 * Use this everywhere user-facing UI, error fallbacks, and contact-related
 * routes need to surface a way to reach us. Reseller / white-label flows
 * still use the per-organization `support_email` column — this constant is
 * the Genesis-brand fallback only.
 */
export const SUPPORT_EMAIL = "support@majix.ai";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}` as const;
