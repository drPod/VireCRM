import type { ClientInstrumentation } from '../common/types';
/**
 * Options for creating Sentry client instrumentation.
 */
export interface CreateSentryClientInstrumentationOptions {
    /**
     * Whether to capture errors from loaders/actions automatically.
     * Set to `false` to avoid duplicates if using custom error handlers.
     * @default true
     */
    captureErrors?: boolean;
}
/**
 * Creates a Sentry client instrumentation for React Router's instrumentation API.
 * @experimental
 */
export declare function createSentryClientInstrumentation(options?: CreateSentryClientInstrumentationOptions): ClientInstrumentation;
/**
 * Check if React Router's instrumentation API is being used on the client.
 * @experimental
 */
export declare function isClientInstrumentationApiUsed(): boolean;
/**
 * Check if React Router's instrumentation API's navigate hook was invoked.
 * @experimental
 */
export declare function isNavigateHookInvoked(): boolean;
//# sourceMappingURL=createClientInstrumentation.d.ts.map