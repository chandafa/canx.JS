/**
 * CanxJS JIT Compiler - Compile route handlers for zero runtime overhead
 * Unique feature: Pre-compile route patterns and handlers for maximum performance
 */
interface CompiledRoute {
    pattern: RegExp;
    paramNames: string[];
    handler: Function;
    compiled: boolean;
}
interface JITStats {
    compiledRoutes: number;
    cacheHits: number;
    cacheMisses: number;
    avgCompileTime: number;
}
export declare class JITCompiler {
    private compiledCache;
    private stats;
    private warmupComplete;
    /**
     * Compile a route pattern into optimized regex matcher
     */
    compilePattern(pattern: string): {
        regex: RegExp;
        paramNames: string[];
    };
    /**
     * Compile and cache a route handler
     */
    compile(method: string, path: string, handler: Function): CompiledRoute;
    /**
     * Create an optimized handler with pre-bound parameters
     */
    private createOptimizedHandler;
    /**
     * Match a path against compiled routes
     */
    match(method: string, path: string): {
        handler: Function;
        params: Record<string, string>;
    } | null;
    /**
     * Warmup the JIT compiler with all routes
     */
    warmup(routes: Array<{
        method: string;
        path: string;
        handler: Function;
    }>): void;
    /**
     * Check if warmup is complete
     */
    isWarmedUp(): boolean;
    /**
     * Get JIT compiler statistics
     */
    getStats(): JITStats;
    /**
     * Clear compiled cache
     */
    clear(): void;
}
export declare const jitCompiler: JITCompiler;
export declare function createJITCompiler(): JITCompiler;
export default jitCompiler;
