import type { DurableObjectStorage } from '@cloudflare/workers-types';
import type { SpanLink } from '@sentry/core';
/** Stored span context for creating span links */
export interface StoredSpanContext {
    traceId: string;
    spanId: string;
    sampled: boolean;
}
/**
 * Gets the storage key for a specific method's trace link.
 */
export declare function getTraceLinkKey(methodName: string): string;
/**
 * Stores the current span context in Durable Object storage for trace linking.
 * Uses the original uninstrumented storage to avoid creating spans for internal operations.
 * Errors are silently ignored to prevent internal storage failures from propagating to user code.
 */
export declare function storeSpanContext(originalStorage: DurableObjectStorage, methodName: string): Promise<void>;
/**
 * Retrieves a stored span context from Durable Object storage.
 */
export declare function getStoredSpanContext(originalStorage: DurableObjectStorage, methodName: string): Promise<StoredSpanContext | undefined>;
/**
 * Builds span links from a stored span context.
 */
export declare function buildSpanLinks(storedContext: StoredSpanContext): SpanLink[];
//# sourceMappingURL=traceLinks.d.ts.map