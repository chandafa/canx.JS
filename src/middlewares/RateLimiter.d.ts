/**
 * CanxJS Rate Limiter
 * Token bucket rate limiting middleware with Memory/Redis support
 */
import type { CanxRequest, MiddlewareHandler } from '../types';
export interface RateLimitOptions {
    windowMs?: number;
    max?: number;
    message?: string | object;
    statusCode?: number;
    headers?: boolean;
    keyGenerator?: (req: CanxRequest) => string;
    skip?: (req: CanxRequest) => boolean;
    store?: RateLimitStore;
}
export interface RateLimitStore {
    increment(key: string): Promise<{
        total: number;
        resetTime: number;
    }>;
    decrement(key: string): Promise<void>;
    resetKey(key: string): Promise<void>;
}
export interface RateLimitInfo {
    limit: number;
    current: number;
    remaining: number;
    resetTime: number;
}
export declare class MemoryStore implements RateLimitStore {
    private hits;
    private resetTimes;
    private windowMs;
    constructor(windowMs: number);
    increment(key: string): Promise<{
        total: number;
        resetTime: number;
    }>;
    decrement(key: string): Promise<void>;
    resetKey(key: string): Promise<void>;
}
export declare class CacheStore implements RateLimitStore {
    private windowMs;
    private prefix;
    constructor(windowMs: number, prefix?: string);
    increment(key: string): Promise<{
        total: number;
        resetTime: number;
    }>;
    decrement(key: string): Promise<void>;
    resetKey(key: string): Promise<void>;
}
export declare class RedisStore implements RateLimitStore {
    private client;
    private windowMs;
    private prefix;
    constructor(client: any, windowMs: number, prefix?: string);
    increment(key: string): Promise<{
        total: number;
        resetTime: number;
    }>;
    decrement(key: string): Promise<void>;
    resetKey(key: string): Promise<void>;
}
export declare class RateLimiter {
    private options;
    private store;
    constructor(options?: RateLimitOptions);
    middleware(): MiddlewareHandler;
}
/**
 * Create rate limit middleware
 */
export declare function rateLimit(options?: RateLimitOptions): MiddlewareHandler;
/**
 * Create memory store
 */
export declare function createMemoryStore(windowMs: number): MemoryStore;
/**
 * Create cache store
 */
export declare function createCacheStore(windowMs: number, prefix?: string): CacheStore;
/**
 * Create redis store
 */
export declare function createRedisStore(client: any, windowMs: number, prefix?: string): RedisStore;
export default RateLimiter;
