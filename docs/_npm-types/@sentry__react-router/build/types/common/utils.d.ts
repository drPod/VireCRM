import type { InstrumentationResult } from './types';
/**
 * Extracts pathname from request URL.
 * Falls back to '<unknown>' with DEBUG warning if URL cannot be parsed.
 */
export declare function getPathFromRequest(request: {
    url: string;
}): string;
/**
 * Extracts route pattern from instrumentation info.
 * Prefers `pattern` (planned for v8) over `unstable_pattern` (v7.x).
 */
export declare function getPattern(info: {
    pattern?: string;
    unstable_pattern?: string;
}): string | undefined;
/**
 * Normalizes route path by ensuring it starts with a slash.
 * Returns undefined if the input is falsy.
 */
export declare function normalizeRoutePath(pattern?: string): string | undefined;
/**
 * Captures an error from instrumentation result.
 * Caller must verify result contains an Error before calling.
 */
export declare function captureInstrumentationError(result: InstrumentationResult, captureErrors: boolean, mechanismType: string, data: Record<string, string | boolean>): void;
//# sourceMappingURL=utils.d.ts.map