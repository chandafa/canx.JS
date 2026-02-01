/**
 * CanxJS Tagged Cache
 * Advanced caching with tagging, TTL, and cache invalidation
 */
export interface CacheConfig {
    defaultTtl?: number;
    maxSize?: number;
    prefix?: string;
}
export interface CacheItem<T> {
    value: T;
    tags: string[];
    expiresAt: number | null;
    createdAt: number;
}
export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
}
export interface CacheDriver {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
}
export declare class MemoryCacheDriver implements CacheDriver {
    private store;
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
}
export declare class TaggedCache {
    private driver;
    private config;
    private tagIndex;
    private stats;
    constructor(driver?: CacheDriver, config?: CacheConfig);
    /**
     * Get full key with prefix
     */
    private key;
    /**
     * Get cached value
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Set cached value with optional tags
     */
    put<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void>;
    /**
     * Set alias for put
     */
    set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void>;
    /**
     * Check if key exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Delete cached value
     */
    forget(key: string): Promise<boolean>;
    /**
     * Delete alias for forget
     */
    delete(key: string): Promise<boolean>;
    /**
     * Get or set (remember pattern)
     */
    remember<T>(key: string, ttl: number, callback: () => T | Promise<T>, tags?: string[]): Promise<T>;
    /**
     * Get or set forever
     */
    rememberForever<T>(key: string, callback: () => T | Promise<T>, tags?: string[]): Promise<T>;
    /**
     * Flush all items with specific tag
     */
    flushTag(tag: string): Promise<number>;
    /**
     * Flush multiple tags
     */
    flushTags(tags: string[]): Promise<number>;
    /**
     * Clear all cache
     */
    flush(): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Tag helper - returns a scoped cache for a tag
     */
    tags(...tagNames: string[]): TaggedCacheScope;
    /**
     * Increment numeric value
     */
    increment(key: string, amount?: number): Promise<number>;
    /**
     * Decrement numeric value
     */
    decrement(key: string, amount?: number): Promise<number>;
}
export declare class TaggedCacheScope {
    private cache;
    private scopeTags;
    constructor(cache: TaggedCache, scopeTags: string[]);
    get<T>(key: string): Promise<T | null>;
    put<T>(key: string, value: T, ttl?: number): Promise<void>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    remember<T>(key: string, ttl: number, callback: () => T | Promise<T>): Promise<T>;
    flush(): Promise<number>;
}
/**
 * Initialize default cache
 */
export declare function initCache(driver?: CacheDriver, config?: CacheConfig): TaggedCache;
/**
 * Get default cache instance
 */
export declare function cache(): TaggedCache;
/**
 * Create new cache instance
 */
export declare function createCache(driver?: CacheDriver, config?: CacheConfig): TaggedCache;
export default TaggedCache;
