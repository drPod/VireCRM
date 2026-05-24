import type { InstrumentationConfig } from '@opentelemetry/instrumentation';
import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
/**
 * Instrumentation for React Router's server request handler.
 * This patches the requestHandler function to add Sentry performance monitoring for data loaders.
 */
export declare class ReactRouterInstrumentation extends InstrumentationBase<InstrumentationConfig> {
    constructor(config?: InstrumentationConfig);
    /**
     * Initializes the instrumentation by defining the React Router server modules to be patched.
     */
    protected init(): InstrumentationNodeModuleDefinition;
    /**
     * Creates a proxy around the React Router module exports that patches the createRequestHandler function.
     * This allows us to wrap the request handler to add performance monitoring for data loaders and actions.
     */
    private _createPatchedModuleProxy;
}
//# sourceMappingURL=reactRouter.d.ts.map