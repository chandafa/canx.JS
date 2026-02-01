"use strict";
/**
 * CanxJS Rate Limiter
 * Token bucket rate limiting middleware with Memory/Redis support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = exports.RedisStore = exports.CacheStore = exports.MemoryStore = void 0;
exports.rateLimit = rateLimit;
exports.createMemoryStore = createMemoryStore;
exports.createCacheStore = createCacheStore;
exports.createRedisStore = createRedisStore;
const TaggedCache_1 = require("../cache/TaggedCache");
// ============================================
// Memory Store
// ============================================
class MemoryStore {
    hits = new Map();
    resetTimes = new Map();
    windowMs;
    constructor(windowMs) {
        this.windowMs = windowMs;
    }
    async increment(key) {
        const now = Date.now();
        let resetTime = this.resetTimes.get(key);
        if (!resetTime || resetTime < now) {
            resetTime = now + this.windowMs;
            this.resetTimes.set(key, resetTime);
            this.hits.set(key, 0);
        }
        const total = (this.hits.get(key) || 0) + 1;
        this.hits.set(key, total);
        return { total, resetTime };
    }
    async decrement(key) {
        const current = this.hits.get(key);
        if (current && current > 0) {
            this.hits.set(key, current - 1);
        }
    }
    async resetKey(key) {
        this.hits.delete(key);
        this.resetTimes.delete(key);
    }
}
exports.MemoryStore = MemoryStore;
// ============================================
// Cache Store (uses TaggedCache)
// ============================================
class CacheStore {
    windowMs;
    prefix;
    constructor(windowMs, prefix = 'rl:') {
        this.windowMs = windowMs;
        this.prefix = prefix;
    }
    async increment(key) {
        const fullKey = `${this.prefix}${key}`;
        const now = Date.now();
        // We store hits and reset time in cache
        // This is a simplified implementation - ideal would be atomic + expire
        // Check if key exists (simulated atomic increment)
        const cached = await (0, TaggedCache_1.cache)().get(fullKey);
        let hits = 1;
        let reset = now + this.windowMs;
        if (cached && cached.reset > now) {
            hits = cached.hits + 1;
            reset = cached.reset;
        }
        // TTL in seconds
        const ttl = Math.ceil((reset - now) / 1000);
        await (0, TaggedCache_1.cache)().put(fullKey, { hits, reset }, ttl);
        return { total: hits, resetTime: reset };
    }
    async decrement(key) {
        // Not easily supported with simple cache set/get without race conditions
        // Simulating best effort
        const fullKey = `${this.prefix}${key}`;
        const cached = await (0, TaggedCache_1.cache)().get(fullKey);
        if (cached && cached.hits > 0) {
            await (0, TaggedCache_1.cache)().put(fullKey, { ...cached, hits: cached.hits - 1 });
        }
    }
    async resetKey(key) {
        await (0, TaggedCache_1.cache)().forget(`${this.prefix}${key}`);
    }
}
exports.CacheStore = CacheStore;
// ============================================
// Redis Store (Direct IORedis)
// ============================================
class RedisStore {
    client;
    windowMs;
    prefix;
    constructor(client, windowMs, prefix = 'rl:') {
        this.client = client;
        this.windowMs = windowMs;
        this.prefix = prefix;
    }
    async increment(key) {
        const k = this.prefix + key;
        const now = Date.now();
        // Check if client is usable
        if (!this.client || typeof this.client.multi !== 'function') {
            throw new Error('Invalid Redis client provided to RedisStore');
        }
        const multi = this.client.multi();
        multi.incr(k);
        multi.pttl(k);
        const results = await multi.exec();
        const total = results[0][1];
        let pttl = results[1][1];
        if (pttl === -1) {
            await this.client.pexpire(k, this.windowMs);
            pttl = this.windowMs;
        }
        return {
            total, // Map count to total to match interface
            resetTime: now + pttl,
        };
    }
    async decrement(key) {
        const k = this.prefix + key;
        await this.client.decr(k);
    }
    async resetKey(key) {
        const k = this.prefix + key;
        await this.client.del(k);
    }
}
exports.RedisStore = RedisStore;
// ============================================
// Rate Limiter Middleware
// ============================================
class RateLimiter {
    options;
    store;
    constructor(options = {}) {
        this.options = {
            windowMs: options.windowMs ?? 60 * 1000, // 1 minute
            max: options.max ?? 60, // 60 requests
            message: options.message ?? 'Too many requests, please try again later.',
            statusCode: options.statusCode ?? 429,
            headers: options.headers ?? true,
            keyGenerator: options.keyGenerator ?? ((req) => (req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1')),
            skip: options.skip ?? (() => false),
            store: options.store, // handled below
        };
        this.store = options.store || new MemoryStore(this.options.windowMs);
    }
    middleware() {
        return async (req, res, next) => {
            if (this.options.skip(req)) {
                return next();
            }
            const key = this.options.keyGenerator(req);
            const { total, resetTime } = await this.store.increment(key);
            const remaining = Math.max(0, this.options.max - total);
            const resetSeconds = Math.ceil((resetTime - Date.now()) / 1000);
            // Set headers
            if (this.options.headers) {
                res.header('X-RateLimit-Limit', String(this.options.max));
                res.header('X-RateLimit-Remaining', String(remaining));
                res.header('X-RateLimit-Reset', String(resetSeconds));
            }
            // Check limit
            if (total > this.options.max) {
                if (this.options.headers) {
                    res.header('Retry-After', String(resetSeconds));
                }
                return res.status(this.options.statusCode).json(typeof this.options.message === 'string'
                    ? { success: false, error: 'Too Many Requests', message: this.options.message }
                    : this.options.message);
            }
            req.rateLimit = {
                limit: this.options.max,
                current: total,
                remaining,
                resetTime,
            };
            return next();
        };
    }
}
exports.RateLimiter = RateLimiter;
// ============================================
// Factory
// ============================================
/**
 * Create rate limit middleware
 */
function rateLimit(options) {
    const limiter = new RateLimiter(options);
    return limiter.middleware();
}
/**
 * Create memory store
 */
function createMemoryStore(windowMs) {
    return new MemoryStore(windowMs);
}
/**
 * Create cache store
 */
function createCacheStore(windowMs, prefix) {
    return new CacheStore(windowMs, prefix);
}
/**
 * Create redis store
 */
function createRedisStore(client, windowMs, prefix) {
    return new RedisStore(client, windowMs, prefix);
}
exports.default = RateLimiter;
