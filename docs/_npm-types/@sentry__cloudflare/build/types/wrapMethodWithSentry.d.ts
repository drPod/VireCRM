import type { DurableObjectStorage } from '@cloudflare/workers-types';
import type { CloudflareOptions } from './client';
/** Extended DurableObjectState with originalStorage exposed by instrumentContext */
interface InstrumentedDurableObjectState extends DurableObjectState {
    originalStorage?: DurableObjectStorage;
}
type MethodWrapperOptions = {
    spanName?: string;
    spanOp?: string;
    options: CloudflareOptions;
    context: ExecutionContext | InstrumentedDurableObjectState;
    /**
     * If true, starts a fresh trace instead of inheriting from a parent trace.
     * Useful for scheduled/independent invocations like alarms.
     *
     * If true, it also stores the current span context and links to the previous invocation's span.
     * Uses Durable Object storage to persist the link. The link is set asynchronously via `span.addLinks()`
     * in a `waitUntil` to avoid blocking.
     *
     * @default false
     */
    startNewTrace?: boolean;
};
export type UncheckedMethod = (...args: any[]) => any;
type OriginalMethod = UncheckedMethod;
/**
 * Wraps a method with Sentry error tracking and optional tracing.
 * Supports starting new traces and linking to previous invocations via Durable Object storage.
 *
 * @param wrapperOptions - The options for the wrapper.
 * @param handler - The method to wrap.
 * @param callback - The callback to call.
 * @param noMark - Whether to mark the method as instrumented.
 * @returns The wrapped method.
 */
export declare function wrapMethodWithSentry<T extends OriginalMethod>(wrapperOptions: MethodWrapperOptions, handler: T, callback?: (...args: Parameters<T>) => void, noMark?: true): T;
export {};
//# sourceMappingURL=wrapMethodWithSentry.d.ts.map