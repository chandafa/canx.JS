"use strict";
/**
 * CanxJS AutoCache - Intelligent automatic caching layer
 * Unique feature: Auto-detect cacheable responses with query pattern analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoCache = void 0;
exports.autoCacheMiddleware = autoCacheMiddleware;
exports.createAutoCache = createAutoCache;
// In-memory LRU Cache implementation
class LRUCache {
    cache = new Map();
    maxSize;
    constructor(maxSize = 10000) {
        this.maxSize = maxSize;
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item)
            return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, item);
        return item.value;
    }
    set(key, value, ttlSeconds = 300) {
        if (this.cache.size >= this.maxSize) {
            // Remove oldest (first) item
            const firstKey = this.cache.keys().next().value;
            if (firstKey)
                this.cache.delete(firstKey);
        }
        this.cache.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
    }
    delete(key) {
        return this.cache.delete(key);
    }
    has(key) {
        const item = this.cache.get(key);
        if (!item)
            return false;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    clear() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
}
// Pattern analyzer for smart caching decisions
class PatternAnalyzer {
    patterns = new Map();
    analyze(path, method, duration, statusCode) {
        const key = `${method}:${this.normalizePath(path)}`;
        const existing = this.patterns.get(key) || { hits: 0, cacheable: true, avgDuration: 0 };
        existing.hits++;
        existing.avgDuration = (existing.avgDuration * (existing.hits - 1) + duration) / existing.hits;
        // Determine if cacheable
        // - Only GET requests
        // - Successful responses (2xx)
        // - High frequency paths benefit from caching
        // - Slow responses (>100ms) should be cached
        if (method !== 'GET' || statusCode < 200 || statusCode >= 300) {
            existing.cacheable = false;
        }
        else if (existing.hits > 10 || existing.avgDuration > 100) {
            existing.cacheable = true;
        }
        this.patterns.set(key, existing);
        return existing.cacheable;
    }
    normalizePath(path) {
        // Replace dynamic segments with placeholders
        return path.replace(/\/\d+/g, '/:id').replace(/\/[a-f0-9-]{36}/gi, '/:uuid');
    }
    getStats() {
        return new Map(this.patterns);
    }
}
// AutoCache Manager
class AutoCacheManager {
    cache;
    analyzer;
    config;
    hits = 0;
    misses = 0;
    constructor(config = {}) {
        this.config = {
            enabled: true,
            defaultTtl: 300,
            exclude: ['/api/auth/*', '/api/*/private'],
            keyGenerator: (req) => `${req.method}:${req.path}:${JSON.stringify(req.query)}`,
            ...config,
        };
        this.cache = new LRUCache(10000);
        this.analyzer = new PatternAnalyzer();
    }
    /**
     * Get cached response
     */
    get(req) {
        if (!this.config.enabled || req.method !== 'GET')
            return null;
        if (this.isExcluded(req.path))
            return null;
        const key = this.config.keyGenerator(req);
        const cached = this.cache.get(key);
        if (cached) {
            this.hits++;
            const headers = new Headers(cached.headers);
            headers.set('X-Cache', 'HIT');
            return new Response(cached.body, { status: cached.status, headers });
        }
        this.misses++;
        return null;
    }
    /**
     * Store response in cache
     */
    async set(req, response, duration) {
        if (!this.config.enabled || req.method !== 'GET')
            return response;
        if (this.isExcluded(req.path))
            return response;
        // Analyze pattern
        const shouldCache = this.analyzer.analyze(req.path, req.method, duration, response.status);
        if (!shouldCache)
            return response;
        // Clone and cache response
        const cloned = response.clone();
        const body = await cloned.text();
        const headers = {};
        cloned.headers.forEach((v, k) => (headers[k] = v));
        const key = this.config.keyGenerator(req);
        this.cache.set(key, { body, headers, status: response.status }, this.config.defaultTtl);
        // Add cache header to original response
        const newHeaders = new Headers(response.headers);
        newHeaders.set('X-Cache', 'MISS');
        return new Response(body, { status: response.status, headers: newHeaders });
    }
    /**
     * Invalidate cache by pattern
     */
    invalidate(pattern) {
        // Simple implementation - clear all for now
        // Could be enhanced with pattern matching
        this.cache.clear();
    }
    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
    isExcluded(path) {
        return this.config.exclude?.some((pattern) => {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return regex.test(path);
        }) ?? false;
    }
    getStats() {
        const total = this.hits + this.misses;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            size: this.cache.size(),
        };
    }
}
// Singleton instance
exports.autoCache = new AutoCacheManager();
// Middleware factory
function autoCacheMiddleware(config) {
    const manager = new AutoCacheManager(config);
    return async (req, res, next) => {
        // Check cache first
        const cached = manager.get(req);
        if (cached)
            return cached;
        // Execute handler and cache response
        const start = performance.now();
        const response = await next();
        const duration = performance.now() - start;
        if (response) {
            return manager.set(req, response, duration);
        }
        return response;
    };
}
function createAutoCache(config) {
    return new AutoCacheManager(config);
}
exports.default = exports.autoCache;
