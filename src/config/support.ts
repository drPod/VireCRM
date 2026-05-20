/**
 * Single source of truth for the Majix business / support email.
 *
 * Use this everywhere user-facing UI, error fallbacks, and contact-related
 * routes need to surface a way to reach us. Reseller / white-label flows
 * still use the per-organization `support_email` column — this constant is
 * the VireCRM-brand fallback only.
 */
export const SUPPORT_EMAIL = "support@virecrm.com";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}` as const;
