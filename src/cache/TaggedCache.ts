/**
 * CanxJS Tagged Cache
 * Advanced caching with tagging, TTL, and cache invalidation
 */

// ============================================
// Types
// ============================================

export interface CacheConfig {
  defaultTtl?: number; // seconds (default: 3600)
  maxSize?: number; // max items (default: 1000)
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

// ============================================
// Cache Driver Interface
// ============================================

export interface CacheDriver {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

// ============================================
// Memory Cache Driver
// ============================================

export class MemoryCacheDriver implements CacheDriver {
  private store: Map<string, { value: unknown; expiresAt: number | null }> = new Map();

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

// ============================================
// Tagged Cache
// ============================================

export class TaggedCache {
  private driver: CacheDriver;
  private config: Required<CacheConfig>;
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> keys
  private stats = { hits: 0, misses: 0 };

  constructor(driver?: CacheDriver, config?: CacheConfig) {
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
  private key(key: string): string {
    return `${this.config.prefix}${key}`;
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    const result = await this.driver.get<CacheItem<T>>(this.key(key));
    
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
  async put<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    const fullKey = this.key(key);
    const expiresAt = (ttl ?? this.config.defaultTtl) > 0 
      ? Date.now() + (ttl ?? this.config.defaultTtl) * 1000 
      : null;

    const item: CacheItem<T> = {
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
        this.tagIndex.get(tag)!.add(key);
      }
    }
  }

  /**
   * Set alias for put
   */
  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    return this.put(key, value, ttl, tags);
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    const item = await this.get(key);
    return item !== null;
  }

  /**
   * Delete cached value
   */
  async forget(key: string): Promise<boolean> {
    const fullKey = this.key(key);
    
    // Get item to remove from tag index
    const item = await this.driver.get<CacheItem<unknown>>(fullKey);
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
  async delete(key: string): Promise<boolean> {
    return this.forget(key);
  }

  /**
   * Get or set (remember pattern)
   */
  async remember<T>(key: string, ttl: number, callback: () => T | Promise<T>, tags?: string[]): Promise<T> {
    const cached = await this.get<T>(key);
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
  async rememberForever<T>(key: string, callback: () => T | Promise<T>, tags?: string[]): Promise<T> {
    return this.remember(key, 0, callback, tags);
  }

  /**
   * Flush all items with specific tag
   */
  async flushTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) return 0;

    let count = 0;
    for (const key of keys) {
      if (await this.forget(key)) count++;
    }
    
    this.tagIndex.delete(tag);
    return count;
  }

  /**
   * Flush multiple tags
   */
  async flushTags(tags: string[]): Promise<number> {
    let count = 0;
    for (const tag of tags) {
      count += await this.flushTag(tag);
    }
    return count;
  }

  /**
   * Clear all cache
   */
  async flush(): Promise<void> {
    await this.driver.clear();
    this.tagIndex.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
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
  tags(...tagNames: string[]): TaggedCacheScope {
    return new TaggedCacheScope(this, tagNames);
  }

  /**
   * Increment numeric value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    const current = (await this.get<number>(key)) || 0;
    const newValue = current + amount;
    await this.put(key, newValue);
    return newValue;
  }

  /**
   * Decrement numeric value
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.increment(key, -amount);
  }
}

// ============================================
// Tagged Cache Scope (for fluent tag API)
// ============================================

export class TaggedCacheScope {
  constructor(private cache: TaggedCache, private scopeTags: string[]) {}

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  async put<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.cache.put(key, value, ttl, this.scopeTags);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.put(key, value, ttl);
  }

  async remember<T>(key: string, ttl: number, callback: () => T | Promise<T>): Promise<T> {
    return this.cache.remember(key, ttl, callback, this.scopeTags);
  }

  async flush(): Promise<number> {
    return this.cache.flushTags(this.scopeTags);
  }
}

// ============================================
// Factory & Singleton
// ============================================

let defaultCache: TaggedCache | null = null;

/**
 * Initialize default cache
 */
export function initCache(driver?: CacheDriver, config?: CacheConfig): TaggedCache {
  defaultCache = new TaggedCache(driver, config);
  return defaultCache;
}

/**
 * Get default cache instance
 */
export function cache(): TaggedCache {
  if (!defaultCache) {
    defaultCache = new TaggedCache();
  }
  return defaultCache;
}

/**
 * Create new cache instance
 */
export function createCache(driver?: CacheDriver, config?: CacheConfig): TaggedCache {
  return new TaggedCache(driver, config);
}

export default TaggedCache;
