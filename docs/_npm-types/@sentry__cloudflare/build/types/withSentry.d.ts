import type { env as cloudflareEnv } from 'cloudflare:workers';
import type { CloudflareOptions } from './client';
import { type WorkerEntrypointConstructor } from './instrumentations/instrumentWorkerEntrypoint';
/**
 * Wrapper for Cloudflare handlers.
 *
 * Initializes the SDK and wraps the handler with Sentry instrumentation.
 *
 * Automatically instruments the `fetch` method of the handler.
 *
 * @param optionsCallback Function that returns the options for the SDK initialization.
 * @param handler {ExportedHandler} The handler to wrap.
 * @returns The wrapped handler.
 */
export declare function withSentry<Env = typeof cloudflareEnv, QueueHandlerMessage = unknown, CfHostMetadata = unknown, T extends ExportedHandler<Env, QueueHandlerMessage, CfHostMetadata> | WorkerEntrypointConstructor = ExportedHandler<Env, QueueHandlerMessage, CfHostMetadata>>(optionsCallback: (env: Env) => CloudflareOptions | undefined, handler: T): T;
//# sourceMappingURL=withSentry.d.ts.map