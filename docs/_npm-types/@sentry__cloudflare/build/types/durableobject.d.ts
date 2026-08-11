import type { DurableObject } from 'cloudflare:workers';
import type { CloudflareOptions } from './client';
/**
 * Instruments a Durable Object class to capture errors and performance data.
 *
 * Instruments the following methods by default:
 * - fetch
 * - alarm
 * - webSocketMessage
 * - webSocketClose
 * - webSocketError
 *
 * To instrument RPC methods (prototype methods), enable the `enableRpcTracePropagation` option.
 *
 * @param optionsCallback Function that returns the options for the SDK initialization.
 * @param DurableObjectClass The Durable Object class to instrument.
 * @returns The instrumented Durable Object class.
 *
 * @example
 * ```ts
 * class MyDurableObjectBase extends DurableObject {
 *   constructor(ctx: DurableObjectState, env: Env) {
 *     super(ctx, env);
 *   }
 * }
 *
 * export const MyDurableObject = instrumentDurableObjectWithSentry(
 *   env => ({
 *     dsn: env.SENTRY_DSN,
 *     tracesSampleRate: 1.0,
 *   }),
 *   MyDurableObjectBase,
 * );
 * ```
 */
export declare function instrumentDurableObjectWithSentry<E, T extends DurableObject<E>, C extends new (state: DurableObjectState, env: E) => T>(optionsCallback: (env: E) => CloudflareOptions, DurableObjectClass: C): C;
//# sourceMappingURL=durableobject.d.ts.map