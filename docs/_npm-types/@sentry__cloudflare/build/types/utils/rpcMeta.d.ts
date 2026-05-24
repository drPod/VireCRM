import { type SerializedTraceData } from '@sentry/core';
/**
 * Appends Sentry RPC metadata to an args array for trace propagation.
 * If no active trace exists, returns the original args unchanged.
 */
export declare function appendRpcMeta(args: unknown[]): unknown[];
/**
 * Extracts Sentry RPC metadata from the trailing argument of an args array.
 * Returns cleaned args (without meta) and the extracted trace data if found.
 */
export declare function extractRpcMeta<T extends unknown[]>(args: T): {
    args: T;
    rpcMeta?: SerializedTraceData;
};
//# sourceMappingURL=rpcMeta.d.ts.map