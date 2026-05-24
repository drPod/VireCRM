import type { CloudflareOptions } from '../../client';
/**
 * Wraps the Cloudflare `env` object in a Proxy that detects binding types
 * on property access and returns instrumented versions.
 *
 * Currently detects:
 * - DurableObjectNamespace (via `idFromName` duck-typing)
 * - Service bindings / JSRPC proxies
 * - Queue producers (via `send` + `sendBatch` duck-typing)
 *
 * Extensible for future binding types (KV, D1, etc.).
 *
 * @param env - The Cloudflare env object to instrument
 * @param options - Optional CloudflareOptions to control RPC trace propagation
 */
export declare function instrumentEnv<Env extends Record<string, unknown>>(env: Env, options?: CloudflareOptions): Env;
//# sourceMappingURL=instrumentEnv.d.ts.map