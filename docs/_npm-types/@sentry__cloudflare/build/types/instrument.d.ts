/**
 * Mark an object as instrumented, storing the instrumented version.
 * @param original The original uninstrumented object
 * @param instrumented The instrumented version (defaults to original if not provided)
 */
export declare function markAsInstrumented<T>(original: T, instrumented?: T): void;
/**
 * Get the instrumented version of an object, if available.
 * Returns the instrumented version if the object was previously instrumented,
 * or undefined if not found.
 */
export declare function getInstrumented<T>(obj: T): T | undefined;
/**
 * Returns the already-instrumented version of `original` if one exists,
 * otherwise calls `instrumentFn` to create it, marks the mapping, and returns it.
 *
 * @param noMark - If true, skips storing the original→instrumented mapping.
 */
export declare function ensureInstrumented<T>(original: T, instrumentFn: (original: T) => T, noMark?: boolean): T;
//# sourceMappingURL=instrument.d.ts.map