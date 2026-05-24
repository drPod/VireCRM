import type { Fetcher } from '@cloudflare/workers-types';
/**
 * Wraps a fetch-like function to create a span and propagate trace headers
 * (`sentry-trace` and `baggage`) on the outgoing request.
 *
 * Useful for instrumenting Cloudflare bindings that expose a `fetch` method
 * (e.g. Durable Object stubs, Service bindings).
 */
export declare function instrumentFetcher(fetchFn: Fetcher['fetch']): Fetcher['fetch'];
//# sourceMappingURL=instrumentFetcher.d.ts.map