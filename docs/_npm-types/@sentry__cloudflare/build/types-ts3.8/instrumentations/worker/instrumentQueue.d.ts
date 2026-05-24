import { ExportedHandler } from '@cloudflare/workers-types';
import { env as cloudflareEnv, WorkerEntrypoint } from 'cloudflare:workers';
import { CloudflareOptions } from '../../client';
/**
 * Instruments a queue handler for ExportedHandler (env/ctx come from args).
 */
export declare function instrumentExportedHandlerQueue<T extends ExportedHandler<any, any, any>>(handler: T, optionsCallback: (env: typeof cloudflareEnv) => CloudflareOptions | undefined): void;
/**
 * Instruments a queue method for WorkerEntrypoint (options/context already available).
 */
export declare function instrumentWorkerEntrypointQueue<T extends WorkerEntrypoint>(instance: T, options: CloudflareOptions, context: ExecutionContext): void;
//# sourceMappingURL=instrumentQueue.d.ts.map
