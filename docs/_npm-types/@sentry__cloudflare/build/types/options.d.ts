import type { CloudflareOptions } from './client';
/**
 * Merges the options passed in from the user with the options we read from
 * the Cloudflare `env` environment variable object.
 *
 * Release is determined with the following priority (highest to lowest):
 * 1. User-provided release option
 * 2. SENTRY_RELEASE environment variable
 * 3. CF_VERSION_METADATA.id binding (if configured in the wrangler config)
 *
 * @param userOptions - The options passed in from the user.
 * @param env - The environment variables.
 *
 * @returns The final options.
 */
export declare function getFinalOptions(userOptions: CloudflareOptions | undefined, env: unknown): CloudflareOptions;
//# sourceMappingURL=options.d.ts.map