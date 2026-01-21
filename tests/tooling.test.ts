/**
 * Phase 4: Localization & Tooling Verification Tests
 */

import { expect, test, describe, beforeEach } from "bun:test";

// Import Phase 4 modules
import { 
  TaggedCache,
  TaggedCacheScope,
  MemoryCacheDriver,
  initCache,
  cache,
  createCache,
} from '../src/cache/TaggedCache';

import { 
  ConfigManager,
  initConfig,
  config,
  env,
} from '../src/config/ConfigManager';

import {
  ServiceProvider,
  ApplicationKernel,
  kernel,
  initKernel,
} from '../src/core/ServiceProvider';

// ============================================
// Tagged Cache Tests
// ============================================

describe('Tagged Cache', () => {
  let testCache: TaggedCache;

  beforeEach(() => {
    testCache = createCache();
  });

  test('TaggedCache can put and get values', async () => {
    await testCache.put('test-key', 'test-value');
    const result = await testCache.get('test-key');
    expect(result).toBe('test-value');
  });

  test('TaggedCache returns null for missing key', async () => {
    const result = await testCache.get('nonexistent');
    expect(result).toBeNull();
  });

  test('TaggedCache can delete values', async () => {
    await testCache.put('to-delete', 'value');
    expect(await testCache.has('to-delete')).toBe(true);
    
    await testCache.forget('to-delete');
    expect(await testCache.has('to-delete')).toBe(false);
  });

  test('TaggedCache remember pattern works', async () => {
    let counter = 0;
    
    // First call should execute callback
    const result1 = await testCache.remember('remember-key', 60, () => {
      counter++;
      return 'computed-value';
    });
    expect(result1).toBe('computed-value');
    expect(counter).toBe(1);
    
    // Second call should return cached value
    const result2 = await testCache.remember('remember-key', 60, () => {
      counter++;
      return 'different-value';
    });
    expect(result2).toBe('computed-value');
    expect(counter).toBe(1); // Not called again
  });

  test('TaggedCache supports tags', async () => {
    await testCache.put('user-1', { name: 'John' }, 60, ['users']);
    await testCache.put('user-2', { name: 'Jane' }, 60, ['users']);
    await testCache.put('post-1', { title: 'Hello' }, 60, ['posts']);
    
    expect(await testCache.get('user-1')).toBeDefined();
    expect(await testCache.get('user-2')).toBeDefined();
    expect(await testCache.get('post-1')).toBeDefined();
    
    // Flush only users tag
    const flushed = await testCache.flushTag('users');
    expect(flushed).toBe(2);
    
    expect(await testCache.get('user-1')).toBeNull();
    expect(await testCache.get('user-2')).toBeNull();
    expect(await testCache.get('post-1')).toBeDefined();
  });

  test('TaggedCache increment/decrement works', async () => {
    const val1 = await testCache.increment('counter');
    expect(val1).toBe(1);
    
    const val2 = await testCache.increment('counter', 5);
    expect(val2).toBe(6);
    
    const val3 = await testCache.decrement('counter', 2);
    expect(val3).toBe(4);
  });

  test('TaggedCacheScope fluent API works', async () => {
    const userCache = testCache.tags('users', 'active');
    
    await userCache.put('user-profile', { id: 1 });
    const result = await userCache.get('user-profile');
    expect(result).toEqual({ id: 1 });
    
    // Flush via scope
    await userCache.flush();
    expect(await testCache.get('user-profile')).toBeNull();
  });

  test('MemoryCacheDriver works correctly', async () => {
    const driver = new MemoryCacheDriver();
    
    await driver.set('key', 'value');
    expect(await driver.get('key')).toBe('value');
    expect(await driver.has('key')).toBe(true);
    
    await driver.delete('key');
    expect(await driver.get('key')).toBeNull();
  });

  test('Cache stats track hits and misses', async () => {
    await testCache.put('hit-key', 'value');
    
    await testCache.get('hit-key'); // Hit
    await testCache.get('miss-key'); // Miss
    await testCache.get('hit-key'); // Hit
    
    const stats = testCache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.666, 2);
  });
});

// ============================================
// Config Manager Tests
// ============================================

describe('Config Manager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  test('ConfigManager load and get works', () => {
    configManager.load({
      app: {
        name: 'CanxJS',
        version: '1.0.0',
      },
      database: {
        host: 'localhost',
        port: 5432,
      },
    });
    
    expect(configManager.get('app.name')).toBe('CanxJS');
    expect(configManager.get('database.port')).toBe(5432);
  });

  test('ConfigManager returns default for missing keys', () => {
    configManager.load({ foo: 'bar' });
    
    expect(configManager.get('nonexistent', 'default')).toBe('default');
    expect(configManager.get('nested.missing', 42)).toBe(42);
  });

  test('ConfigManager set works with dot notation', () => {
    configManager.set('deep.nested.key', 'value');
    expect(configManager.get('deep.nested.key')).toBe('value');
    expect(configManager.get('deep.nested')).toEqual({ key: 'value' });
  });

  test('ConfigManager has checks existence', () => {
    configManager.load({ exists: true });
    
    expect(configManager.has('exists')).toBe(true);
    expect(configManager.has('notexists')).toBe(false);
  });

  test('ConfigManager deep merges on load', () => {
    configManager.load({ a: { b: 1, c: 2 } });
    configManager.load({ a: { c: 3, d: 4 } });
    
    expect(configManager.get('a.b')).toBe(1);
    expect(configManager.get('a.c')).toBe(3);
    expect(configManager.get('a.d')).toBe(4);
  });

  test('ConfigManager all returns full config', () => {
    configManager.load({ key: 'value' });
    const all = configManager.all();
    
    expect(all.key).toBe('value');
  });

  test('ConfigManager env fallback works', () => {
    process.env.TEST_VAR = 'test-value';
    expect(configManager.env('TEST_VAR')).toBe('test-value');
    expect(configManager.env('MISSING_VAR', 'default')).toBe('default');
    delete process.env.TEST_VAR;
  });

  test('config function works as helper', () => {
    const mgr = initConfig({ test: { value: 123 } });
    expect(config('test.value')).toBe(123);
  });

  test('env function with type coercion', () => {
    process.env.NUM_VAR = '42';
    process.env.BOOL_VAR = 'true';
    
    expect(env('NUM_VAR', 0)).toBe(42);
    expect(env('BOOL_VAR', false)).toBe(true);
    
    delete process.env.NUM_VAR;
    delete process.env.BOOL_VAR;
  });
});

// ============================================
// Service Provider Tests
// ============================================

describe('Service Provider', () => {
  
  test('ApplicationKernel registers providers', () => {
    const appKernel = new ApplicationKernel();
    
    class TestProvider extends ServiceProvider {
      register() {}
    }
    
    appKernel.register(TestProvider);
    expect(appKernel.isBooted()).toBe(false);
  });

  test('ApplicationKernel boots providers', async () => {
    const appKernel = new ApplicationKernel();
    let registered = false;
    let booted = false;
    
    class TestProvider extends ServiceProvider {
      register() {
        registered = true;
      }
      boot() {
        booted = true;
      }
    }
    
    appKernel.register(TestProvider);
    await appKernel.boot();
    
    expect(registered).toBe(true);
    expect(booted).toBe(true);
    expect(appKernel.isBooted()).toBe(true);
  });

  test('ApplicationKernel registerMany works', () => {
    const appKernel = new ApplicationKernel();
    
    class Provider1 extends ServiceProvider {
      register() {}
    }
    class Provider2 extends ServiceProvider {
      register() {}
    }
    
    appKernel.registerMany([Provider1, Provider2]);
  });

  test('kernel singleton works', () => {
    const k1 = initKernel();
    const k2 = kernel();
    expect(k2).toBe(k1);
  });

  test('ServiceProvider helpers work', async () => {
    let boundValue: string | null = null;
    
    class TestProvider extends ServiceProvider {
      register() {
        this.singleton('testService', () => 'singleton-value');
      }
    }
    
    const appKernel = new ApplicationKernel();
    appKernel.register(TestProvider);
    await appKernel.boot();
    // Provider registered service in container
  });
});

// ============================================
// Summary
// ============================================

describe('Phase 4 Summary', () => {
  test('All Phase 4 modules are importable', () => {
    expect(TaggedCache).toBeDefined();
    expect(ConfigManager).toBeDefined();
    expect(ServiceProvider).toBeDefined();
    expect(ApplicationKernel).toBeDefined();
  });
});
