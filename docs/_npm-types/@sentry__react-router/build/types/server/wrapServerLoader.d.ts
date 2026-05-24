import type { SpanAttributes } from '@sentry/core';
import type { LoaderFunctionArgs } from 'react-router';
type SpanOptions = {
    name?: string;
    attributes?: SpanAttributes;
};
/**
 * Wraps a React Router server loader function with Sentry performance monitoring.
 * @param options - Optional span configuration options including name, operation, description and attributes
 * @param loaderFn - The server loader function to wrap
 *
 * @example
 * ```ts
 * // Wrap a loader function with custom span options
 * export const loader = wrapServerLoader(
 *   {
 *     name: 'Load Some Data',
 *     description: 'Loads some data from the db',
 *   },
 *   async ({ params }) => {
 *     // ... your loader logic
 *   }
 * );
 * ```
 */
export declare function wrapServerLoader<T>(options: SpanOptions | undefined, loaderFn: (args: LoaderFunctionArgs) => Promise<T>): (args: LoaderFunctionArgs) => Promise<T>;
export {};
//# sourceMappingURL=wrapServerLoader.d.ts.map