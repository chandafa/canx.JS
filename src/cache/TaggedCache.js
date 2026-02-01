"use strict";
/**
 * CanxJS Tagged Cache
 * Advanced caching with tagging, TTL, and cache invalidation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaggedCacheScope = exports.TaggedCache = exports.MemoryCacheDriver = void 0;
exports.initCache = initCache;
exports.cache = cache;
exports.createCache = createCache;
// ============================================
// Memory Cache Driver
// ============================================
class MemoryCacheDriver {
    store = new Map();
    async get(key) {
        const item = this.store.get(key);
        if (!item)
            return null;
        if (item.expiresAt && item.expiresAt < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }
    async set(key, value, ttl) {
        const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
        this.store.set(key, { value, expiresAt });
    }
    async has(key) {
        return (await this.get(key)) !== null;
    }
    async delete(key) {
        return this.store.delete(key);
    }
    async clear() {
        this.store.clear();
    }
    async keys() {
        return Array.from(this.store.keys());
    }
}
exports.MemoryCacheDriver = MemoryCacheDriver;
// ============================================
// Tagged Cache
// ============================================
class TaggedCache {
    driver;
    config;
    tagIndex = new Map(); // tag -> keys
    stats = { hits: 0, misses: 0 };
    constructor(driver, config) {
        this.driver = driver || new MemoryCacheDriver();
        this.config = {
            defaultTtl: config?.defaultTtl ?? 3600,
            maxSize: config?.maxSize ?? 1000,
            prefix: config?.prefix ?? 'cache:',
        };
    }
    /**
     * Get full key with prefix
     */
    key(key) {
        return `${this.config.prefix}${key}`;
    }
    /**
     * Get cached value
     */
    async get(key) {
        const result = await this.driver.get(this.key(key));
        if (result === null) {
            this.stats.misses++;
            return null;
        }
        // Check expiration
        if (result.expiresAt && result.expiresAt < Date.now()) {
            await this.forget(key);
            this.stats.misses++;
            return null;
        }
        this.stats.hits++;
        return result.value;
    }
    /**
     * Set cached value with optional tags
     */
    async put(key, value, ttl, tags) {
        const fullKey = this.key(key);
        const expiresAt = (ttl ?? this.config.defaultTtl) > 0
            ? Date.now() + (ttl ?? this.config.defaultTtl) * 1000
            : null;
        const item = {
            value,
            tags: tags || [],
            expiresAt,
            createdAt: Date.now(),
        };
        await this.driver.set(fullKey, item);
        // Index tags
        if (tags) {
            for (const tag of tags) {
                if (!this.tagIndex.has(tag)) {
                    this.tagIndex.set(tag, new Set());
                }
                this.tagIndex.get(tag).add(key);
            }
        }
    }
    /**
     * Set alias for put
     */
    async set(key, value, ttl, tags) {
        return this.put(key, value, ttl, tags);
    }
    /**
     * Check if key exists
     */
    async has(key) {
        const item = await this.get(key);
        return item !== null;
    }
    /**
     * Delete cached value
     */
    async forget(key) {
        const fullKey = this.key(key);
        // Get item to remove from tag index
        const item = await this.driver.get(fullKey);
        if (item?.tags) {
            for (const tag of item.tags) {
                this.tagIndex.get(tag)?.delete(key);
            }
        }
        return this.driver.delete(fullKey);
    }
    /**
     * Delete alias for forget
     */
    async delete(key) {
        return this.forget(key);
    }
    /**
     * Get or set (remember pattern)
     */
    async remember(key, ttl, callback, tags) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        const value = await callback();
        await this.put(key, value, ttl, tags);
        return value;
    }
    /**
     * Get or set forever
     */
    async rememberForever(key, callback, tags) {
        return this.remember(key, 0, callback, tags);
    }
    /**
     * Flush all items with specific tag
     */
    async flushTag(tag) {
        const keys = this.tagIndex.get(tag);
        if (!keys || keys.size === 0)
            return 0;
        let count = 0;
        for (const key of keys) {
            if (await this.forget(key))
                count++;
        }
        this.tagIndex.delete(tag);
        return count;
    }
    /**
     * Flush multiple tags
     */
    async flushTags(tags) {
        let count = 0;
        for (const tag of tags) {
            count += await this.flushTag(tag);
        }
        return count;
    }
    /**
     * Clear all cache
     */
    async flush() {
        await this.driver.clear();
        this.tagIndex.clear();
        this.stats = { hits: 0, misses: 0 };
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            size: this.tagIndex.size,
            hitRate: total > 0 ? this.stats.hits / total : 0,
        };
    }
    /**
     * Tag helper - returns a scoped cache for a tag
     */
    tags(...tagNames) {
        return new TaggedCacheScope(this, tagNames);
    }
    /**
     * Increment numeric value
     */
    async increment(key, amount = 1) {
        const current = (await this.get(key)) || 0;
        const newValue = current + amount;
        await this.put(key, newValue);
        return newValue;
    }
    /**
     * Decrement numeric value
     */
    async decrement(key, amount = 1) {
        return this.increment(key, -amount);
    }
}
exports.TaggedCache = TaggedCache;
// ============================================
// Tagged Cache Scope (for fluent tag API)
// ============================================
class TaggedCacheScope {
    cache;
    scopeTags;
    constructor(cache, scopeTags) {
        this.cache = cache;
        this.scopeTags = scopeTags;
    }
    async get(key) {
        return this.cache.get(key);
    }
    async put(key, value, ttl) {
        return this.cache.put(key, value, ttl, this.scopeTags);
    }
    async set(key, value, ttl) {
        return this.put(key, value, ttl);
    }
    async remember(key, ttl, callback) {
        return this.cache.remember(key, ttl, callback, this.scopeTags);
    }
    async flush() {
        return this.cache.flushTags(this.scopeTags);
    }
}
exports.TaggedCacheScope = TaggedCacheScope;
// ============================================
// Factory & Singleton
// ============================================
let defaultCache = null;
/**
 * Initialize default cache
 */
function initCache(driver, config) {
    defaultCache = new TaggedCache(driver, config);
    return defaultCache;
}
/**
 * Get default cache instance
 */
function cache() {
    if (!defaultCache) {
        defaultCache = new TaggedCache();
    }
    return defaultCache;
}
/**
 * Create new cache instance
 */
function createCache(driver, config) {
    return new TaggedCache(driver, config);
}
exports.default = TaggedCache;
