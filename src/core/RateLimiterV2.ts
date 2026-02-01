/**
 * CanxJS Rate Limiter v2 - Advanced sliding window rate limiting
 * @description Distributed rate limiting with multiple algorithms and Redis support
 */

export type RateLimitAlgorithm = 'fixed-window' | 'sliding-window' | 'token-bucket' | 'leaky-bucket';

export interface RateLimiterV2Config {
  /** Maximum requests allowed */
  limit: number;
  /** Window size in milliseconds */
  window: number;
  /** Algorithm to use */
  algorithm?: RateLimitAlgorithm;
  /** Key generator */
  keyGenerator?: (req: any) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: any) => boolean;
  /** Custom handler when rate limited */
  handler?: (req: any, res: any, retryAfter: number) => Response;
  /** Headers to add */
  headers?: boolean;
  /** Store for rate limit data */
  store?: RateLimitStore;
}

export interface RateLimitStore {
  increment(key: string, window: number): Promise<{ count: number; reset: number }>;
  get(key: string): Promise<{ count: number; reset: number } | null>;
  reset(key: string): Promise<void>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
  retryAfter?: number;
}

/**
 * In-memory rate limit store with sliding window
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { timestamps: number[]; reset: number }>();

  async increment(key: string, window: number): Promise<{ count: number; reset: number }> {
    const now = Date.now();
    const windowStart = now - window;
    
    let entry = this.store.get(key);
    
    if (!entry) {
      entry = { timestamps: [], reset: now + window };
      this.store.set(key, entry);
    }

    // Remove timestamps outside window (sliding window)
    entry.timestamps = entry.timestamps.filter(t => t > windowStart);
    entry.timestamps.push(now);
    entry.reset = now + window;

    return { count: entry.timestamps.length, reset: entry.reset };
  }

  async get(key: string): Promise<{ count: number; reset: number } | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    // Clean up expired entries
    const now = Date.now();
    entry.timestamps = entry.timestamps.filter(t => t > now - 60000);
    
    return { count: entry.timestamps.length, reset: entry.reset };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * Redis rate limit store
 */
export class RedisRateLimitStore implements RateLimitStore {
  private redis: any;
  private prefix: string;

  constructor(redisClient: any, prefix: string = 'rl:') {
    this.redis = redisClient;
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async increment(key: string, window: number): Promise<{ count: number; reset: number }> {
    const redisKey = this.getKey(key);
    const now = Date.now();
    const windowStart = now - window;
    
    // Use Redis sorted set for sliding window
    const multi = this.redis.multi();
    multi.zremrangebyscore(redisKey, 0, windowStart);
    multi.zadd(redisKey, now, `${now}-${Math.random()}`);
    multi.zcard(redisKey);
    multi.pexpire(redisKey, window);
    
    const results = await multi.exec();
    const count = results[2][1] as number;
    
    return { count, reset: now + window };
  }

  async get(key: string): Promise<{ count: number; reset: number } | null> {
    const redisKey = this.getKey(key);
    const count = await this.redis.zcard(redisKey);
    const ttl = await this.redis.pttl(redisKey);
    
    if (count === 0) return null;
    
    return { count, reset: Date.now() + ttl };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(this.getKey(key));
  }
}

/**
 * Advanced Rate Limiter v2
 */
export class RateLimiterV2 {
  private config: Required<RateLimiterV2Config>;
  private store: RateLimitStore;

  constructor(config: RateLimiterV2Config) {
    this.store = config.store ?? new MemoryRateLimitStore();
    
    this.config = {
      limit: config.limit,
      window: config.window,
      algorithm: config.algorithm ?? 'sliding-window',
      keyGenerator: config.keyGenerator ?? ((req) => {
        return req.header?.('x-forwarded-for') ?? 
               req.header?.('x-real-ip') ?? 
               'unknown';
      }),
      skip: config.skip ?? (() => false),
      handler: config.handler ?? ((req, res, retryAfter) => {
        return new Response(JSON.stringify({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
          retryAfter,
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(retryAfter / 1000)),
          },
        });
      }),
      headers: config.headers ?? true,
      store: this.store,
    };
  }

  /**
   * Check rate limit for a key
   */
  async check(key: string): Promise<RateLimitResult> {
    const { count, reset } = await this.store.increment(key, this.config.window);
    const allowed = count <= this.config.limit;
    const remaining = Math.max(0, this.config.limit - count);
    
    return {
      allowed,
      remaining,
      reset,
      limit: this.config.limit,
      retryAfter: allowed ? undefined : reset - Date.now(),
    };
  }

  /**
   * Consume a request for the given key
   */
  async consume(key: string, cost: number = 1): Promise<RateLimitResult> {
    // For sliding window, each increment is cost 1
    // For multiple costs, we'd need to call increment multiple times
    let result: RateLimitResult = {
      allowed: true,
      remaining: this.config.limit,
      reset: Date.now() + this.config.window,
      limit: this.config.limit,
    };

    for (let i = 0; i < cost; i++) {
      result = await this.check(key);
      if (!result.allowed) break;
    }

    return result;
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    await this.store.reset(key);
  }

  /**
   * Get current status for a key
   */
  async getStatus(key: string): Promise<RateLimitResult | null> {
    const data = await this.store.get(key);
    if (!data) return null;

    return {
      allowed: data.count <= this.config.limit,
      remaining: Math.max(0, this.config.limit - data.count),
      reset: data.reset,
      limit: this.config.limit,
    };
  }

  /**
   * Create middleware
   */
  middleware() {
    return async (req: any, res: any, next: () => Promise<Response | void>): Promise<Response | void> => {
      // Check if should skip
      if (this.config.skip(req)) {
        return next();
      }

      const key = this.config.keyGenerator(req);
      const result = await this.check(key);

      // Add headers if enabled
      const addHeaders = (response: Response) => {
        if (this.config.headers) {
          response.headers.set('X-RateLimit-Limit', String(result.limit));
          response.headers.set('X-RateLimit-Remaining', String(result.remaining));
          response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.reset / 1000)));
        }
        return response;
      };

      if (!result.allowed) {
        return addHeaders(this.config.handler(req, res, result.retryAfter!));
      }

      const response = await next();
      if (response) {
        return addHeaders(response);
      }
      return response;
    };
  }
}

// ============================================
// Tiered Rate Limiting
// ============================================

export interface RateLimitTier {
  name: string;
  limit: number;
  window: number;
}

/**
 * Tiered Rate Limiter for API tiers (free, pro, enterprise)
 */
export class TieredRateLimiter {
  private limiters = new Map<string, RateLimiterV2>();
  private tierResolver: (req: any) => string;
  private defaultTier: string;

  constructor(
    tiers: RateLimitTier[],
    tierResolver: (req: any) => string,
    defaultTier: string = 'default',
    store?: RateLimitStore
  ) {
    this.tierResolver = tierResolver;
    this.defaultTier = defaultTier;

    for (const tier of tiers) {
      this.limiters.set(tier.name, new RateLimiterV2({
        limit: tier.limit,
        window: tier.window,
        store,
      }));
    }

    // Ensure default tier exists
    if (!this.limiters.has(defaultTier)) {
      this.limiters.set(defaultTier, new RateLimiterV2({
        limit: 100,
        window: 60000,
        store,
      }));
    }
  }

  async check(req: any): Promise<RateLimitResult> {
    const tier = this.tierResolver(req);
    const limiter = this.limiters.get(tier) ?? this.limiters.get(this.defaultTier)!;
    const key = req.header?.('x-forwarded-for') ?? req.header?.('x-real-ip') ?? 'unknown';
    return limiter.check(`${tier}:${key}`);
  }

  middleware() {
    return async (req: any, res: any, next: () => Promise<Response | void>): Promise<Response | void> => {
      const result = await this.check(req);

      if (!result.allowed) {
        return new Response(JSON.stringify({
          error: 'Too Many Requests',
          retryAfter: Math.ceil(result.retryAfter! / 1000),
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(result.retryAfter! / 1000)),
          },
        });
      }

      const response = await next();
      if (response) {
        response.headers.set('X-RateLimit-Limit', String(result.limit));
        response.headers.set('X-RateLimit-Remaining', String(result.remaining));
      }
      return response;
    };
  }
}

// ============================================
// Factory Functions
// ============================================

export function createRateLimiterV2(config: RateLimiterV2Config): RateLimiterV2 {
  return new RateLimiterV2(config);
}

export function createTieredRateLimiter(
  tiers: RateLimitTier[],
  tierResolver: (req: any) => string,
  defaultTier?: string,
  store?: RateLimitStore
): TieredRateLimiter {
  return new TieredRateLimiter(tiers, tierResolver, defaultTier, store);
}

export default RateLimiterV2;
