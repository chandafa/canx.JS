/**
 * CanxJS Rate Limiter
 * Token bucket rate limiting middleware with Memory/Redis support
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler, NextFunction } from '../types';
import { cache, TaggedCache } from '../cache/TaggedCache';

// ============================================
// Types
// ============================================

export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Max requests per window
  message?: string | object;
  statusCode?: number;
  headers?: boolean;
  keyGenerator?: (req: CanxRequest) => string;
  skip?: (req: CanxRequest) => boolean;
  store?: RateLimitStore;
}

export interface RateLimitStore {
  increment(key: string): Promise<{ total: number; resetTime: number }>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
}

// ============================================
// Memory Store
// ============================================

export class MemoryStore implements RateLimitStore {
  private hits: Map<string, number> = new Map();
  private resetTimes: Map<string, number> = new Map();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ total: number; resetTime: number }> {
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

  async decrement(key: string): Promise<void> {
    const current = this.hits.get(key);
    if (current && current > 0) {
      this.hits.set(key, current - 1);
    }
  }

  async resetKey(key: string): Promise<void> {
    this.hits.delete(key);
    this.resetTimes.delete(key);
  }
}

// ============================================
// Cache Store (uses TaggedCache)
// ============================================

export class CacheStore implements RateLimitStore {
  private windowMs: number;
  private prefix: string;

  constructor(windowMs: number, prefix: string = 'rl:') {
    this.windowMs = windowMs;
    this.prefix = prefix;
  }

  async increment(key: string): Promise<{ total: number; resetTime: number }> {
    const fullKey = `${this.prefix}${key}`;
    const now = Date.now();
    
    // We store hits and reset time in cache
    // This is a simplified implementation - ideal would be atomic + expire
    
    // Check if key exists (simulated atomic increment)
    const cached = await cache().get<{ hits: number; reset: number }>(fullKey);
    
    let hits = 1;
    let reset = now + this.windowMs;
    
    if (cached && cached.reset > now) {
      hits = cached.hits + 1;
      reset = cached.reset;
    }

    // TTL in seconds
    const ttl = Math.ceil((reset - now) / 1000);
    
    await cache().put(fullKey, { hits, reset }, ttl);

    return { total: hits, resetTime: reset };
  }

  async decrement(key: string): Promise<void> {
    // Not easily supported with simple cache set/get without race conditions
    // Simulating best effort
    const fullKey = `${this.prefix}${key}`;
    const cached = await cache().get<{ hits: number; reset: number }>(fullKey);
    if (cached && cached.hits > 0) {
      await cache().put(fullKey, { ...cached, hits: cached.hits - 1 });
    }
  }

  async resetKey(key: string): Promise<void> {
    await cache().forget(`${this.prefix}${key}`);
  }
}

// ============================================
// Redis Store (Direct IORedis)
// ============================================

export class RedisStore implements RateLimitStore {
  constructor(
    private client: any, 
    private windowMs: number,
    private prefix: string = 'rl:'
  ) {}

  async increment(key: string): Promise<{ total: number; resetTime: number }> {
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
    const total = results[0][1] as number;
    let pttl = results[1][1] as number;
    
    if (pttl === -1) {
      await this.client.pexpire(k, this.windowMs);
      pttl = this.windowMs;
    }

    return {
      total, // Map count to total to match interface
      resetTime: now + pttl,
    };
  }

  async decrement(key: string): Promise<void> {
    const k = this.prefix + key;
    await this.client.decr(k);
  }

  async resetKey(key: string): Promise<void> {
    const k = this.prefix + key;
    await this.client.del(k);
  }
}

// ============================================
// Rate Limiter Middleware
// ============================================

export class RateLimiter {
  private options: Required<RateLimitOptions>;
  private store: RateLimitStore;

  constructor(options: RateLimitOptions = {}) {
    this.options = {
      windowMs: options.windowMs ?? 60 * 1000, // 1 minute
      max: options.max ?? 60, // 60 requests
      message: options.message ?? 'Too many requests, please try again later.',
      statusCode: options.statusCode ?? 429,
      headers: options.headers ?? true,
      keyGenerator: options.keyGenerator ?? ((req) => 
        (req.headers.get('x-forwarded-for') || (req as any).ip || '127.0.0.1')
      ),
      skip: options.skip ?? (() => false),
      store: options.store as any, // handled below
    };

    this.store = options.store || new MemoryStore(this.options.windowMs);
  }

  middleware(): MiddlewareHandler {
    return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
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
        
        return res.status(this.options.statusCode).json(
          typeof this.options.message === 'string'
            ? { success: false, error: 'Too Many Requests', message: this.options.message }
            : this.options.message
        );
      }

      (req as any).rateLimit = {
        limit: this.options.max,
        current: total,
        remaining,
        resetTime,
      };

      return next();
    };
  }
}

// ============================================
// Factory
// ============================================

/**
 * Create rate limit middleware
 */
export function rateLimit(options?: RateLimitOptions): MiddlewareHandler {
  const limiter = new RateLimiter(options);
  return limiter.middleware();
}

/**
 * Create memory store
 */
export function createMemoryStore(windowMs: number): MemoryStore {
  return new MemoryStore(windowMs);
}

/**
 * Create cache store
 */
export function createCacheStore(windowMs: number, prefix?: string): CacheStore {
  return new CacheStore(windowMs, prefix);
}

/**
 * Create redis store
 */
export function createRedisStore(client: any, windowMs: number, prefix?: string): RedisStore {
  return new RedisStore(client, windowMs, prefix);
}

export default RateLimiter;
