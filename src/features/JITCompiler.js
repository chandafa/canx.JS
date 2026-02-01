"use strict";
/**
 * CanxJS JIT Compiler - Compile route handlers for zero runtime overhead
 * Unique feature: Pre-compile route patterns and handlers for maximum performance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.jitCompiler = exports.JITCompiler = void 0;
exports.createJITCompiler = createJITCompiler;
class JITCompiler {
    compiledCache = new Map();
    stats = { compiledRoutes: 0, cacheHits: 0, cacheMisses: 0, avgCompileTime: 0 };
    warmupComplete = false;
    /**
     * Compile a route pattern into optimized regex matcher
     */
    compilePattern(pattern) {
        const paramNames = [];
        // Convert route pattern to optimized regex
        // /users/:id/posts/:postId -> /users/([^/]+)/posts/([^/]+)
        const regexPattern = pattern
            .replace(/\//g, '\\/')
            .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
            paramNames.push(name);
            return '([^\\/]+)';
        })
            .replace(/\*/g, '(.*)');
        return {
            regex: new RegExp(`^${regexPattern}$`),
            paramNames,
        };
    }
    /**
     * Compile and cache a route handler
     */
    compile(method, path, handler) {
        const key = `${method}:${path}`;
        if (this.compiledCache.has(key)) {
            this.stats.cacheHits++;
            return this.compiledCache.get(key);
        }
        this.stats.cacheMisses++;
        const startTime = performance.now();
        const { regex, paramNames } = this.compilePattern(path);
        // Create optimized handler wrapper
        const optimizedHandler = this.createOptimizedHandler(handler, paramNames);
        const compiled = {
            pattern: regex,
            paramNames,
            handler: optimizedHandler,
            compiled: true,
        };
        this.compiledCache.set(key, compiled);
        this.stats.compiledRoutes++;
        const compileTime = performance.now() - startTime;
        this.stats.avgCompileTime =
            (this.stats.avgCompileTime * (this.stats.compiledRoutes - 1) + compileTime) / this.stats.compiledRoutes;
        return compiled;
    }
    /**
     * Create an optimized handler with pre-bound parameters
     */
    createOptimizedHandler(handler, paramNames) {
        // Return a closure that extracts params efficiently
        return (req, res, match) => {
            const params = {};
            for (let i = 0; i < paramNames.length; i++) {
                params[paramNames[i]] = match[i + 1];
            }
            req.params = params;
            return handler(req, res);
        };
    }
    /**
     * Match a path against compiled routes
     */
    match(method, path) {
        for (const [key, route] of this.compiledCache) {
            if (!key.startsWith(method + ':'))
                continue;
            const match = path.match(route.pattern);
            if (match) {
                const params = {};
                for (let i = 0; i < route.paramNames.length; i++) {
                    params[route.paramNames[i]] = match[i + 1];
                }
                return { handler: route.handler, params };
            }
        }
        return null;
    }
    /**
     * Warmup the JIT compiler with all routes
     */
    warmup(routes) {
        console.log('[CanxJS JIT] Warming up compiler...');
        const startTime = performance.now();
        for (const route of routes) {
            this.compile(route.method, route.path, route.handler);
        }
        const duration = (performance.now() - startTime).toFixed(2);
        this.warmupComplete = true;
        console.log(`[CanxJS JIT] Warmup complete: ${routes.length} routes compiled in ${duration}ms`);
    }
    /**
     * Check if warmup is complete
     */
    isWarmedUp() {
        return this.warmupComplete;
    }
    /**
     * Get JIT compiler statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Clear compiled cache
     */
    clear() {
        this.compiledCache.clear();
        this.stats = { compiledRoutes: 0, cacheHits: 0, cacheMisses: 0, avgCompileTime: 0 };
        this.warmupComplete = false;
    }
}
exports.JITCompiler = JITCompiler;
// Singleton instance
exports.jitCompiler = new JITCompiler();
function createJITCompiler() {
    return new JITCompiler();
}
exports.default = exports.jitCompiler;
