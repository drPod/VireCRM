/**
 * A handler function for React Router's `onError` prop on `HydratedRouter`.
 *
 * Reports errors to Sentry.
 *
 * @example (entry.client.tsx)
 * ```tsx
 * import { sentryOnError } from '@sentry/react-router';
 *
 * startTransition(() => {
 *   hydrateRoot(
 *     document,
 *     <HydratedRouter onError={sentryOnError} />
 *   );
 * });
 * ```
 */
export declare function sentryOnError(error: unknown, { errorInfo, }: {
    errorInfo?: React.ErrorInfo;
}): void;
//# sourceMappingURL=sentryOnError.d.ts.map