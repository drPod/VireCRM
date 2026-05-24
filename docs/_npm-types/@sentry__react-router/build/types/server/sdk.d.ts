import type { Integration } from '@sentry/core';
import type { NodeClient, NodeOptions } from '@sentry/node';
/**
 * Returns the default integrations for the React Router SDK.
 * @param options The options for the SDK.
 */
export declare function getDefaultReactRouterServerIntegrations(options: NodeOptions): Integration[];
/**
 * Initializes the server side of the React Router SDK
 */
export declare function init(options: NodeOptions): NodeClient | undefined;
//# sourceMappingURL=sdk.d.ts.map