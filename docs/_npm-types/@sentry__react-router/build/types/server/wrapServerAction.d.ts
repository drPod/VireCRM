import type { SpanAttributes } from '@sentry/core';
import type { ActionFunctionArgs } from 'react-router';
type SpanOptions = {
    name?: string;
    attributes?: SpanAttributes;
};
/**
 * Wraps a React Router server action function with Sentry performance monitoring.
 * @param options - Optional span configuration options including name, operation, description and attributes
 * @param actionFn - The server action function to wrap
 *
 * @example
 * ```ts
 * // Wrap an action function with custom span options
 * export const action = wrapServerAction(
 *   {
 *     name: 'Submit Form Data',
 *     description: 'Processes form submission data',
 *   },
 *   async ({ request }) => {
 *     // ... your action logic
 *   }
 * );
 * ```
 */
export declare function wrapServerAction<T>(options: SpanOptions | undefined, actionFn: (args: ActionFunctionArgs) => Promise<T>): (args: ActionFunctionArgs) => Promise<T>;
export {};
//# sourceMappingURL=wrapServerAction.d.ts.map