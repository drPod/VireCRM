/**
 * Gets the op name for a request based on whether it's a loader or action request.
 * @param pathName The URL pathname to check
 * @param requestMethod The HTTP request method
 */
export declare function getOpName(pathName: string, requestMethod: string): string;
/**
 * Gets the span name for a request based on whether it's a loader or action request.
 * @param pathName The URL pathname to check
 * @param requestMethod The HTTP request method
 */
export declare function getSpanName(pathName: string, requestMethod: string): string;
/**
 * Checks if the request is a server loader request
 * @param pathname The URL pathname to check
 * @param requestMethod The HTTP request method
 */
export declare function isLoaderRequest(pathname: string, requestMethod: string): boolean;
/**
 * Checks if the request is a server action request
 * @param pathname The URL pathname to check
 * @param requestMethod The HTTP request method
 */
export declare function isActionRequest(pathname: string, requestMethod: string): boolean;
/**
 * Checks if the request is a react-router data request
 * @param pathname The URL pathname to check
 */
export declare function isDataRequest(pathname: string): boolean;
export declare const SEMANTIC_ATTRIBUTE_SENTRY_OVERWRITE = "sentry.overwrite-route";
//# sourceMappingURL=util.d.ts.map