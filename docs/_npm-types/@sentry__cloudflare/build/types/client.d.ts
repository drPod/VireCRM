import type { ClientOptions, Options } from '@sentry/core';
import { ServerRuntimeClient } from '@sentry/core';
import type { makeFlushLock } from './flush';
import type { CloudflareTransportOptions } from './transport';
/**
 * The Sentry Cloudflare SDK Client.
 *
 * @see CloudflareClientOptions for documentation on configuration options.
 * @see ServerRuntimeClient for usage documentation.
 */
export declare class CloudflareClient extends ServerRuntimeClient {
    private readonly _flushLock;
    private _pendingSpans;
    private _spanCompletionPromise;
    private _resolveSpanCompletion;
    private _unsubscribeSpanStart;
    private _unsubscribeSpanEnd;
    /**
     * Creates a new Cloudflare SDK instance.
     * @param options Configuration options for this SDK.
     */
    constructor(options: CloudflareClientOptions);
    /**
     * Flushes pending operations and ensures all data is processed.
     * If a timeout is provided, the operation will be completed within the specified time limit.
     *
     * It will wait for all pending spans to complete before flushing.
     *
     * @param {number} [timeout] - Optional timeout in milliseconds to force the completion of the flush operation.
     * @return {Promise<boolean>} A promise that resolves to a boolean indicating whether the flush operation was successful.
     */
    flush(timeout?: number): Promise<boolean>;
    /**
     * Disposes of the client and releases all resources.
     *
     * This method clears all Cloudflare-specific state in addition to the base client cleanup.
     * It unsubscribes from span lifecycle events and clears pending span tracking.
     *
     * Call this method after flushing to allow the client to be garbage collected.
     * After calling dispose(), the client should not be used anymore.
     */
    dispose(): void;
    /**
     * Resets the span completion promise and resolve function.
     */
    private _resetSpanCompletionPromise;
}
interface BaseCloudflareOptions {
    /**
     * @ignore Used internally to disable the deDupeIntegration for workflows.
     * @hidden Used internally to disable the deDupeIntegration for workflows.
     * @default true
     */
    enableDedupe?: boolean;
    /**
     * The Cloudflare SDK is not OpenTelemetry native, however, we set up some OpenTelemetry compatibility
     * via a custom trace provider.
     * This ensures that any spans emitted via `@opentelemetry/api` will be captured by Sentry.
     * HOWEVER, big caveat: This does not handle custom context handling, it will always work off the current scope.
     * This should be good enough for many, but not all integrations.
     *
     * If you want to opt-out of setting up the OpenTelemetry compatibility tracer, set this to `true`.
     *
     * @default false
     */
    skipOpenTelemetrySetup?: boolean;
    /**
     * Enable trace propagation for RPC calls between Workers, Durable Objects, and Service Bindings.
     *
     * When enabled, trace context (sentry-trace + baggage) is propagated across:
     * - `stub.fetch()` calls to Durable Objects (via HTTP headers)
     * - Service binding `fetch()` calls (via HTTP headers)
     * - RPC method calls to Durable Objects (via trailing argument)
     *
     * When enabled on the **receiver side** (DurableObject), the SDK will also:
     * - Extract and continue traces from incoming RPC calls
     * - Create spans for each RPC method invocation
     * - Capture errors thrown by RPC methods
     *
     * **Important:** This option should be enabled on **both sides** for full trace propagation.
     *
     * @default false
     * @example
     * ```ts
     * // Worker side (caller)
     * export default Sentry.withSentry(
     *   (env) => ({
     *     dsn: env.SENTRY_DSN,
     *     enableRpcTracePropagation: true,
     *   }),
     *   handler,
     * );
     *
     * // Durable Object side (receiver)
     * export const MyDO = Sentry.instrumentDurableObjectWithSentry(
     *   (env) => ({
     *     dsn: env.SENTRY_DSN,
     *     enableRpcTracePropagation: true,
     *   }),
     *   MyDOBase,
     * );
     * ```
     */
    enableRpcTracePropagation?: boolean;
    /**
     * @deprecated Use `enableRpcTracePropagation` instead. This option will be removed in a future major version.
     *
     * Enable instrumentation of prototype methods for DurableObjects.
     *
     * When `true`, the SDK will wrap all methods on the DurableObject prototype chain
     * to automatically create spans and capture errors for RPC method calls.
     *
     * When an array of strings is provided, only the specified method names will be instrumented.
     *
     * @default false
     */
    instrumentPrototypeMethods?: boolean | string[];
}
/**
 * Configuration options for the Sentry Cloudflare SDK
 *
 * @see @sentry/core Options for more information.
 */
export interface CloudflareOptions extends Options<CloudflareTransportOptions>, BaseCloudflareOptions {
    ctx?: ExecutionContext;
}
/**
 * Configuration options for the Sentry Cloudflare SDK Client class
 *
 * @see CloudflareClient for more information.
 */
export interface CloudflareClientOptions extends ClientOptions<CloudflareTransportOptions>, BaseCloudflareOptions {
    flushLock?: ReturnType<typeof makeFlushLock>;
}
export {};
//# sourceMappingURL=client.d.ts.map