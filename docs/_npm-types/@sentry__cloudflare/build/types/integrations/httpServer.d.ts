import type { Client, MaxRequestBodySize } from '@sentry/core';
export interface HttpServerIntegrationOptions {
    /**
     * Controls the maximum size of incoming request bodies attached to events.
     *
     * Only applies to requests with textual content types (text/*, application/json,
     * application/x-www-form-urlencoded, application/xml, application/graphql).
     * Binary data is not captured.
     *
     * Available options:
     * - `'none'`: No request bodies will be attached
     * - `'small'`: Request bodies up to 1,000 bytes will be attached
     * - `'medium'`: Request bodies up to 10,000 bytes will be attached (default)
     * - `'always'`: Request bodies will always be attached (up to 1MB limit)
     *
     * @default 'medium'
     */
    maxRequestBodySize?: MaxRequestBodySize;
    /**
     * Do not capture the request body for incoming HTTP requests to URLs where the given callback returns `true`.
     * This can be useful for long running requests where the body is not needed, health check endpoints,
     * or requests containing sensitive data that should not be captured.
     *
     * @param url The full URL of the incoming request, including query string, protocol, host, etc.
     * @param request The incoming Request object.
     * @returns `true` to skip body capture for this request, `false` to capture normally.
     *
     * @example
     * ```ts
     * Sentry.httpServerIntegration({
     *   ignoreRequestBody: (url) => url.includes('/health') || url.includes('/upload'),
     * })
     * ```
     */
    ignoreRequestBody?: (url: string, request: Request) => boolean;
}
/**
 * Configures incoming HTTP request handling for Cloudflare Workers.
 *
 * This integration controls how incoming HTTP request data is captured,
 * matching the API of `httpServerIntegration` in Node.js.
 *
 * @example
 * ```ts
 * Sentry.init({
 *   integrations: [
 *     Sentry.httpServerIntegration({
 *       maxRequestBodySize: 'medium',
 *       ignoreRequestBody: (url) => url.includes('/health'),
 *     }),
 *   ],
 * });
 * ```
 */
export declare const httpServerIntegration: (options?: HttpServerIntegrationOptions | undefined) => import("@sentry/core").Integration;
/**
 * Capture the request body based on the HttpServer integration config.
 * Called internally by `wrapRequestHandler`.
 */
export declare function captureIncomingRequestBody(client: Client, request: Request): Promise<void>;
//# sourceMappingURL=httpServer.d.ts.map