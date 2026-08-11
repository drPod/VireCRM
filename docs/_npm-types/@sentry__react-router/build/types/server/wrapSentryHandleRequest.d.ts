import type { AppLoadContext, EntryContext, RouterContextProvider } from 'react-router';
type OriginalHandleRequestWithoutMiddleware = (request: Request, responseStatusCode: number, responseHeaders: Headers, routerContext: EntryContext, loadContext: AppLoadContext) => Promise<unknown>;
type OriginalHandleRequestWithMiddleware = (request: Request, responseStatusCode: number, responseHeaders: Headers, routerContext: EntryContext, loadContext: RouterContextProvider) => Promise<unknown>;
/**
 * Wraps the original handleRequest function to add Sentry instrumentation.
 *
 * @param originalHandle - The original handleRequest function to wrap
 * @returns A wrapped version of the handle request function with Sentry instrumentation
 */
export declare function wrapSentryHandleRequest(originalHandle: OriginalHandleRequestWithoutMiddleware): OriginalHandleRequestWithoutMiddleware;
/**
 * Wraps the original handleRequest function to add Sentry instrumentation.
 *
 * @param originalHandle - The original handleRequest function to wrap
 * @returns A wrapped version of the handle request function with Sentry instrumentation
 */
export declare function wrapSentryHandleRequest(originalHandle: OriginalHandleRequestWithMiddleware): OriginalHandleRequestWithMiddleware;
/** @deprecated Use `wrapSentryHandleRequest` instead. */
export declare const sentryHandleRequest: typeof wrapSentryHandleRequest;
export {};
//# sourceMappingURL=wrapSentryHandleRequest.d.ts.map