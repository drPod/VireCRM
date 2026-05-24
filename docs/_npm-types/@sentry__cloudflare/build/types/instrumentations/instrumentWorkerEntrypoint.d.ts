import type { env as cloudflareEnv, WorkerEntrypoint } from 'cloudflare:workers';
import type { CloudflareOptions } from '../client';
export type WorkerEntrypointConstructor<Env = typeof cloudflareEnv, Props = {}> = new (ctx: ExecutionContext, env: typeof cloudflareEnv) => InstanceType<typeof WorkerEntrypoint<Env, Props>>;
/**
 * Instruments a WorkerEntrypoint class to capture errors and performance data.
 *
 * Instruments the following methods (same as `withSentry` for ExportedHandler):
 * - fetch (HTTP requests)
 * - scheduled (cron triggers)
 * - queue (queue consumers)
 * - email (email handlers)
 * - tail (tail workers)
 *
 * as well as any other public RPC methods on the WorkerEntrypoint instance.
 *
 * @param optionsCallback Function that returns the options for the SDK initialization.
 * @param WorkerEntrypointClass The WorkerEntrypoint class to instrument.
 * @returns The instrumented WorkerEntrypoint class.
 *
 * @example
 * ```ts
 * class MyWorkerBase extends WorkerEntrypoint<Env> {
 *   async fetch(request: Request): Promise<Response> {
 *     return new Response('Hello World!');
 *   }
 *
 *   async myRpcMethod(arg: string): Promise<string> {
 *     return `Hello ${arg}!`;
 *   }
 * }
 *
 * export default instrumentWorkerEntrypoint(
 *   env => ({
 *     dsn: env.SENTRY_DSN,
 *     tracesSampleRate: 1.0,
 *   }),
 *   MyWorkerBase,
 * );
 * ```
 */
export declare function instrumentWorkerEntrypoint<T extends WorkerEntrypointConstructor>(optionsCallback: (env: typeof cloudflareEnv) => CloudflareOptions | undefined, WorkerEntrypointClass: T): T;
//# sourceMappingURL=instrumentWorkerEntrypoint.d.ts.map