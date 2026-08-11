import type { ServerInstrumentation } from '../common/types';
export { isInstrumentationApiUsed } from './serverGlobals';
/**
 * Options for creating Sentry server instrumentation.
 */
export interface CreateSentryServerInstrumentationOptions {
    /**
     * Whether to capture errors from loaders/actions automatically.
     * @default true
     */
    captureErrors?: boolean;
}
/**
 * Creates a Sentry server instrumentation for React Router's instrumentation API.
 * @experimental
 */
export declare function createSentryServerInstrumentation(options?: CreateSentryServerInstrumentationOptions): ServerInstrumentation;
//# sourceMappingURL=createServerInstrumentation.d.ts.map