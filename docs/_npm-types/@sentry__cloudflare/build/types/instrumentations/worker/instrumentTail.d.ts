import type { ExportedHandler } from '@cloudflare/workers-types';
import type { env as cloudflareEnv, WorkerEntrypoint } from 'cloudflare:workers';
import type { CloudflareOptions } from '../../client';
/**
 * Instruments a tail handler for ExportedHandler (env/ctx come from args).
 */
export declare function instrumentExportedHandlerTail<T extends ExportedHandler<any, any, any>>(handler: T, optionsCallback: (env: typeof cloudflareEnv) => CloudflareOptions | undefined): void;
/**
 * Instruments a tail method for WorkerEntrypoint (options/context already available).
 */
export declare function instrumentWorkerEntrypointTail<T extends WorkerEntrypoint>(instance: T, options: CloudflareOptions, context: ExecutionContext): void;
//# sourceMappingURL=instrumentTail.d.ts.map