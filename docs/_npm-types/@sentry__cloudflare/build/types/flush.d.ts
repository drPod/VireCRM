import type { ExecutionContext } from '@cloudflare/workers-types';
import type { Client } from '@sentry/core';
type FlushLock = {
    readonly ready: Promise<void>;
    readonly finalize: () => Promise<void>;
};
/**
 * Enhances the given execution context by wrapping its `waitUntil` method with a proxy
 * to monitor pending tasks, and provides a flusher function to ensure all tasks
 * have been completed before executing any subsequent logic.
 *
 * @param {ExecutionContext} context - The execution context to be enhanced. If no context is provided, the function returns undefined.
 * @return {FlushLock} Returns a flusher function if a valid context is provided, otherwise undefined.
 */
export declare function makeFlushLock(context: ExecutionContext): FlushLock;
/**
 * Flushes the client and then disposes of it to allow garbage collection.
 * This should be called at the end of each request to prevent memory leaks.
 *
 * @param client - The CloudflareClient instance to flush and dispose
 * @param timeout - Timeout in milliseconds for the flush operation
 * @returns A promise that resolves when flush and dispose are complete
 */
export declare function flushAndDispose(client: Client | undefined, timeout?: number): Promise<void>;
export {};
//# sourceMappingURL=flush.d.ts.map