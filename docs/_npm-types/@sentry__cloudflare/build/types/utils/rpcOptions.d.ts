import type { CloudflareOptions } from '../client';
/**
 * Gets the effective RPC propagation setting, handling deprecation of `instrumentPrototypeMethods`.
 *
 * Priority:
 * 1. If `enableRpcTracePropagation` is set, use it (ignore `instrumentPrototypeMethods`)
 * 2. If only `instrumentPrototypeMethods` is set, use it with deprecation warning
 * 3. If neither is set, return `false`
 *
 * @returns The effective setting for RPC trace propagation
 */
export declare function getEffectiveRpcPropagation(options: CloudflareOptions): boolean;
//# sourceMappingURL=rpcOptions.d.ts.map