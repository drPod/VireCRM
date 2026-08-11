import type { PassThrough } from 'node:stream';
import { Transform } from 'node:stream';
/**
 * Injects Sentry trace meta tags into the HTML response by piping through a transform stream.
 * This enables distributed tracing by adding trace context to the HTML document head.
 *
 * @param body - PassThrough stream containing the HTML response body to modify
 */
export declare function getMetaTagTransformer(body: PassThrough): Transform;
//# sourceMappingURL=getMetaTagTransformer.d.ts.map