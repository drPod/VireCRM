// System hostnames that are never treated as tenant custom domains.
// Single source of truth — imported by DomainBrandingProvider, GlobalErrorBoundary, and login.
export const SYSTEM_HOST_PATTERNS: RegExp[] = [
  /\.lovable\.app$/i,
  /\.lovable-project\.com$/i,
  /\.lovableproject\.com$/i,
  /\.workers\.dev$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/i,
  /^virecrm\.com$/i,
  /^www\.virecrm\.com$/i,
  /^app\.virecrm\.com$/i,
  /^customers\.virecrm\.com$/i,
  /^notify\.virecrm\.com$/i,
];

export function isSystemHost(hostname: string): boolean {
  return SYSTEM_HOST_PATTERNS.some((p) => p.test(hostname));
}

// Platform hosts where tenant users are redirected to their org subdomain after login.
export const PLATFORM_HOSTS = new Set(["virecrm.com", "www.virecrm.com", "app.virecrm.com"]);
