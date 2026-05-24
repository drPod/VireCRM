import type { NodeOptions } from '@sentry/node';
/**
 * Integration that filters out noisy http transactions such as requests to node_modules, favicon.ico, @id/, __manifest.
 * Adds entries to `ignoreSpans` so the filter applies in both static and streaming trace lifecycles.
 */
export declare const lowQualityTransactionsFilterIntegration: (_options?: NodeOptions | undefined) => import("@sentry/core").Integration;
//# sourceMappingURL=lowQualityTransactionsFilterIntegration.d.ts.map