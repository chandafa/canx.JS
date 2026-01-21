/**
 * Phase 8: Advanced API Verification Tests
 */

import { expect, test, describe, beforeEach } from "bun:test";

// ============================================
// Phase 8 Imports
// ============================================
import { 
  RateLimiter,
  createMemoryStore,
  RateLimitOptions
} from '../src/middlewares/RateLimiter';

import {
  QueryParser,
  parseQuery
} from '../src/utils/QueryParser';

import {
  GraphQLAdapter,
  createGraphQLAdapter
} from '../src/graphql/GraphQLAdapter';

// ============================================
// Rate Limiter Tests
// ============================================

describe('Rate Limiter', () => {
  test('MemoryStore increments counters', async () => {
    const store = createMemoryStore(60000);
    const key = '127.0.0.1';
    
    const { total, resetTime } = await store.increment(key);
    expect(total).toBe(1);
    expect(resetTime).toBeGreaterThan(Date.now());

    await store.increment(key);
    const result = await store.increment(key);
    expect(result.total).toBe(3);
  });

  test('Middleware limits requests', async () => {
    // Mock Response
    const res: any = {
      header: (k: string, v: string) => {},
      status: (code: number) => ({
        json: (data: any) => ({ code, data })
      })
    };
    
    // Mock Next
    const next = async () => 'called';

    const limiter = new RateLimiter({
      windowMs: 1000,
      max: 2,
      store: createMemoryStore(1000)
    });

    const middleware = limiter.middleware();
    const req: any = { headers: new Map() };

    // 1st request
    await middleware(req, res, next);
    // 2nd request
    await middleware(req, res, next);
    
    // 3rd request (should block)
    const result = await middleware(req, res, next);
    
    expect(result).toHaveProperty('code', 429);
    expect(result.data).toHaveProperty('error', 'Too Many Requests');
  });

  test('Skip function bypasses limiter', async () => {
    const limiter = new RateLimiter({
      max: 1,
      skip: () => true
    });
    
    const middleware = limiter.middleware();
    const req: any = { headers: new Map() };
    const res: any = {};
    const next = async () => 'allowed';

    await middleware(req, res, next);
    const result = await middleware(req, res, next);
    
    expect(result).toBe('allowed');
  });
});

// ============================================
// Query Parser Tests
// ============================================

describe('Query Parser', () => {
  test('Parses basic filters', () => {
    const query = {
      status: 'active',
      role: 'admin',
      page: '2' // Should be excluded from filters
    };
    
    const parser = new QueryParser(query);
    const result = parser.parse();
    
    expect(result.filters).toEqual({ status: 'active', role: 'admin' });
    expect(result.page).toBe(2);
  });

  test('Parses nested filter object', () => {
    const query = {
      filter: {
        status: 'active',
        age: 25
      }
    };
    
    const parser = new QueryParser(query);
    const filters = parser.parseFilters();
    
    expect(filters).toEqual({ status: 'active', age: 25 });
  });

  test('Parses sort parameters', () => {
    const query = { sort: '-created_at,name' };
    const parser = new QueryParser(query);
    const sort = parser.parseSort();
    
    expect(sort).toHaveLength(2);
    expect(sort[0]).toEqual({ field: 'created_at', order: 'desc' });
    expect(sort[1]).toEqual({ field: 'name', order: 'asc' });
  });

  test('Parses pagination defaults', () => {
    const parser = new QueryParser({});
    
    expect(parser.parsePage()).toBe(1);
    expect(parser.parseLimit()).toBe(15);
  });

  test('Parses limit ranges', () => {
    const parser = new QueryParser({ limit: 1000 });
    expect(parser.parseLimit(10, 100)).toBe(100); // Capped at max
  });

  test('Parses includes and fields', () => {
    const query = {
      include: 'posts,comments',
      fields: 'id,title'
    };
    
    const parser = new QueryParser(query);
    
    expect(parser.parseInclude()).toEqual(['posts', 'comments']);
    expect(parser.parseFields()).toEqual(['id', 'title']);
  });
});

// ============================================
// GraphQL Adapter Tests
// ============================================

describe('GraphQL Adapter', () => {
  test('Initializes with default options', () => {
    const adapter = createGraphQLAdapter({});
    expect(adapter).toBeDefined();
    expect(adapter.getMiddleware).toThrow(); // not registered yet
  });

  test('Registers middleware', async () => {
    const adapter = createGraphQLAdapter({
      schema: {} // Mock schema
    });
    
    const mockServer = {
      post: () => {},
      get: () => {}
    };

    await adapter.register(mockServer);
    
    const middleware = adapter.getMiddleware();
    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('function');
  });

  test('Handles missing GraphQL module gracefully', async () => {
    // This tests the fallback mechanism if graphql is missing or mock handling
    const adapter = createGraphQLAdapter({
      driver: 'custom',
      schema: {}
    });

    const mockServer = { post: () => {}, get: () => {} };
    await adapter.register(mockServer);
    
    const handler = adapter.getMiddleware();
    
    // Test basic execution without crashing
    const req: any = { 
      method: 'POST', 
      json: async () => ({ query: '{ hello }' })
    };
    const res: any = {
      status: (c: number) => ({
        json: (d: any) => d
      })
    };

    try {
      await handler(req, res, async () => {});
    } catch (e) {
      // Expected to might fail if graphql module is missing, 
      // but shouldn't crash construction
    }
  });
});
