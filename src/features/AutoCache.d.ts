/**
 * CanxJS AutoCache - Intelligent automatic caching layer
 * Unique feature: Auto-detect cacheable responses with query pattern analysis
 */
import type { AutoCacheConfig, CanxRequest, MiddlewareHandler } from '../types';
declare class AutoCacheManager {
    private cache;
    private analyzer;
    private config;
    private hits;
    private misses;
    constructor(config?: AutoCacheConfig);
    /**
     * Get cached response
     */
    get(req: CanxRequest): Response | null;
    /**
     * Store response in cache
     */
    set(req: CanxRequest, response: Response, duration: number): Promise<Response>;
    /**
     * Invalidate cache by pattern
     */
    invalidate(pattern: string): void;
    /**
     * Clear entire cache
     */
    clear(): void;
    private isExcluded;
    getStats(): {
        hits: number;
        misses: number;
        hitRate: number;
        size: number;
    };
}
export declare const autoCache: AutoCacheManager;
export declare function autoCacheMiddleware(config?: AutoCacheConfig): MiddlewareHandler;
export declare function createAutoCache(config?: AutoCacheConfig): AutoCacheManager;
export default autoCache;
