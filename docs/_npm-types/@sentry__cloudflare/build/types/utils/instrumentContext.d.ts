import { type DurableObjectState, type ExecutionContext } from '@cloudflare/workers-types';
type ContextType = ExecutionContext | DurableObjectState;
/**
 * Instruments an execution context or DurableObjectState with Sentry tracing.
 *
 * Creates a copy of the context that:
 * - Allows overriding of methods (e.g., waitUntil)
 * - For DurableObjectState: instruments storage operations (get, put, delete, list, etc.)
 *   to create Sentry spans automatically
 *
 * @param ctx - The execution context or DurableObjectState to instrument
 * @returns An instrumented copy of the context
 */
export declare function instrumentContext<T extends ContextType>(ctx: T): T;
export {};
//# sourceMappingURL=instrumentContext.d.ts.map