/**
 * Subset of ServerBuild shape for middleware name lookup.
 * The official React Router types don't expose `middleware` on route modules yet.
 * @internal
 */
interface ServerBuildLike {
    routes?: Record<string, {
        module?: {
            middleware?: Array<{
                name?: string;
            }>;
        };
    }>;
}
/** @internal */
export declare const GLOBAL_KEY = "__sentrySetServerBuild";
/** @internal */
export declare function isServerBuildLike(build: unknown): build is ServerBuildLike;
/** @internal */
export declare function setServerBuild(build: ServerBuildLike): void;
/** @internal */
export declare function getMiddlewareName(routeId: string, index: number): string | undefined;
/** @internal */
export declare function registerServerBuildGlobal(): void;
/** @internal Exported for testing. */
export declare function _resetServerBuild(): void;
export {};
//# sourceMappingURL=serverBuild.d.ts.map