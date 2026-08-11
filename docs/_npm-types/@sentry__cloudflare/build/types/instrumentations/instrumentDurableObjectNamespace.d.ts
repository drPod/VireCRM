import type { DurableObjectNamespace } from '@cloudflare/workers-types';
export declare const STUB_NON_RPC_METHODS: Set<string>;
/**
 * Instruments a DurableObjectNamespace binding to create spans for DO interactions.
 *
 * Wraps:
 * - `namespace.get(id)` / `namespace.getByName(name)` with a span + instruments returned stub
 * - `namespace.idFromName(name)` / `namespace.idFromString(id)` / `namespace.newUniqueId()` with breadcrumbs
 *
 * @param namespace - The DurableObjectNamespace to instrument
 */
export declare function instrumentDurableObjectNamespace(namespace: DurableObjectNamespace): DurableObjectNamespace;
//# sourceMappingURL=instrumentDurableObjectNamespace.d.ts.map