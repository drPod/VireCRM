import type { ExportedHandler } from '@cloudflare/workers-types';
import type { env as cloudflareEnv, WorkerEntrypoint } from 'cloudflare:workers';
import type { CloudflareOptions } from '../../client';
/**
 * Instruments a scheduled handler for ExportedHandler (env/ctx come from args).
 */
export declare function instrumentExportedHandlerScheduled<T extends ExportedHandler<any, any, any>>(handler: T, optionsCallback: (env: typeof cloudflareEnv) => CloudflareOptions | undefined): void;
/**
 * Instruments a scheduled method for WorkerEntrypoint (options/context already available).
 */
export declare function instrumentWorkerEntrypointScheduled<T extends WorkerEntrypoint>(instance: T, options: CloudflareOptions, context: ExecutionContext): void;
//# sourceMappingURL=instrumentScheduled.d.ts.map