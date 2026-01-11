/**
 * CanxJS AutoCache - Intelligent automatic caching layer
 * Unique feature: Auto-detect cacheable responses with query pattern analysis
 */

import type { AutoCacheConfig, CacheDriver, CanxRequest, MiddlewareHandler } from '../types';

// In-memory LRU Cache implementation
class LRUCache<T> {
  private cache: Map<string, { value: T; expiry: number }> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: string, value: T, ttlSeconds: number = 300): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest (first) item
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Pattern analyzer for smart caching decisions
class PatternAnalyzer {
  private patterns: Map<string, { hits: number; cacheable: boolean; avgDuration: number }> = new Map();

  analyze(path: string, method: string, duration: number, statusCode: number): boolean {
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
    } else if (existing.hits > 10 || existing.avgDuration > 100) {
      existing.cacheable = true;
    }

    this.patterns.set(key, existing);
    return existing.cacheable;
  }

  private normalizePath(path: string): string {
    // Replace dynamic segments with placeholders
    return path.replace(/\/\d+/g, '/:id').replace(/\/[a-f0-9-]{36}/gi, '/:uuid');
  }

  getStats(): Map<string, { hits: number; cacheable: boolean; avgDuration: number }> {
    return new Map(this.patterns);
  }
}

// AutoCache Manager
class AutoCacheManager {
  private cache: LRUCache<{ body: string; headers: Record<string, string>; status: number }>;
  private analyzer: PatternAnalyzer;
  private config: AutoCacheConfig;
  private hits: number = 0;
  private misses: number = 0;

  constructor(config: AutoCacheConfig = {}) {
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
  get(req: CanxRequest): Response | null {
    if (!this.config.enabled || req.method !== 'GET') return null;
    if (this.isExcluded(req.path)) return null;

    const key = this.config.keyGenerator!(req);
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
  async set(req: CanxRequest, response: Response, duration: number): Promise<Response> {
    if (!this.config.enabled || req.method !== 'GET') return response;
    if (this.isExcluded(req.path)) return response;

    // Analyze pattern
    const shouldCache = this.analyzer.analyze(req.path, req.method, duration, response.status);
    if (!shouldCache) return response;

    // Clone and cache response
    const cloned = response.clone();
    const body = await cloned.text();
    const headers: Record<string, string> = {};
    cloned.headers.forEach((v, k) => (headers[k] = v));

    const key = this.config.keyGenerator!(req);
    this.cache.set(key, { body, headers, status: response.status }, this.config.defaultTtl);

    // Add cache header to original response
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Cache', 'MISS');
    return new Response(body, { status: response.status, headers: newHeaders });
  }

  /**
   * Invalidate cache by pattern
   */
  invalidate(pattern: string): void {
    // Simple implementation - clear all for now
    // Could be enhanced with pattern matching
    this.cache.clear();
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  private isExcluded(path: string): boolean {
    return this.config.exclude?.some((pattern) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(path);
    }) ?? false;
  }

  getStats(): { hits: number; misses: number; hitRate: number; size: number } {
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
export const autoCache = new AutoCacheManager();

// Middleware factory
export function autoCacheMiddleware(config?: AutoCacheConfig): MiddlewareHandler {
  const manager = new AutoCacheManager(config);

  return async (req, res, next) => {
    // Check cache first
    const cached = manager.get(req);
    if (cached) return cached;

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

export function createAutoCache(config?: AutoCacheConfig): AutoCacheManager {
  return new AutoCacheManager(config);
}

export default autoCache;
