import type { HandleErrorFunction } from 'react-router';
export type SentryHandleErrorOptions = {
    logErrors?: boolean;
};
/**
 * A complete Sentry-instrumented handleError implementation that handles error reporting
 *
 * @returns A Sentry-instrumented handleError function
 */
export declare function createSentryHandleError({ logErrors }: SentryHandleErrorOptions): HandleErrorFunction;
//# sourceMappingURL=createSentryHandleError.d.ts.map