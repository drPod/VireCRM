export * from '../client';
export { wrapSentryHandleRequest } from '../server/wrapSentryHandleRequest';
/**
 * Injects Sentry trace meta tags into the HTML response by transforming the ReadableStream.
 * This enables distributed tracing by adding trace context to the HTML document head.
 * @param body - ReadableStream containing the HTML response body to modify
 * @returns A new ReadableStream with Sentry trace meta tags injected into the head section
 */
export declare function injectTraceMetaTags(body: ReadableStream): ReadableStream;
//# sourceMappingURL=index.d.ts.map