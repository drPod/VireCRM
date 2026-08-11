import type { Integration } from '@sentry/core';
import type { ClientInstrumentation } from '../common/types';
import { type CreateSentryClientInstrumentationOptions } from './createClientInstrumentation';
/**
 * Options for the React Router tracing integration.
 */
export interface ReactRouterTracingIntegrationOptions {
    /**
     * Options for React Router's instrumentation API.
     * @experimental
     */
    instrumentationOptions?: CreateSentryClientInstrumentationOptions;
    /**
     * Enable React Router's instrumentation API.
     * When true, prepares for use with HydratedRouter's `instrumentations` prop.
     * @experimental
     * @default false
     */
    useInstrumentationAPI?: boolean;
}
/**
 * React Router tracing integration with support for the instrumentation API.
 */
export interface ReactRouterTracingIntegration extends Integration {
    /**
     * Client instrumentation for React Router's instrumentation API.
     * Lazily initialized on first access.
     * @experimental HydratedRouter doesn't invoke these hooks in Framework Mode yet.
     */
    readonly clientInstrumentation: ClientInstrumentation;
}
/**
 * Browser tracing integration for React Router (Framework) applications.
 * This integration will create navigation spans and enhance transaction names with parameterized routes.
 */
export declare function reactRouterTracingIntegration(options?: ReactRouterTracingIntegrationOptions): ReactRouterTracingIntegration;
//# sourceMappingURL=tracingIntegration.d.ts.map