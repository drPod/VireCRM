import { ExportedHandler } from '@cloudflare/workers-types';
import { env as cloudflareEnv } from 'cloudflare:workers';
import { CloudflareOptions } from '../../client';
/**
 * Instruments an email handler for ExportedHandler (env/ctx come from args).
 */
export declare function instrumentExportedHandlerEmail<T extends ExportedHandler<any, any, any>>(handler: T, optionsCallback: (env: typeof cloudflareEnv) => CloudflareOptions | undefined): void;
//# sourceMappingURL=instrumentEmail.d.ts.map
