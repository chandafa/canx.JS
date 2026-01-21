/**
 * CanxJS Framework - Comprehensive Feature Verification Script
 * Tests all major exports and features
 */

import {
  // Core
  createApp,
  Canx,
  defineConfig,
  Server,
  Router,
  MiddlewarePipeline,
  cors,
  logger,
  bodyParser,
  rateLimit,
  
  // Auth
  hashPassword,
  verifyPassword,
  signJWT,
  verifyJWT,
  jwtAuth,
  sessionAuth,
  gate,
  defineGate,
  definePolicy,
  
  // MVC
  BaseController,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Model,
  
  // Features
  hotWire,
  autoCache,
  jitCompiler,
  scheduler,
  
  // Database
  Schema as DbSchema,
  seeder,
  
  // Queue
  queue,
  
  // Storage
  storage,
  
  // Events
  events,
  
  // Utils
  validate,
  log,
  hash,
  encrypt,
  decrypt,
  paginate,
  collect,
  initI18n,
  
  // API
  OpenAPIBuilder,
  versioning,
  Resource,
  
  // Container
  container,
  bind,
  singleton,
  
  // Exceptions
  CanxException,
  HttpException,
  NotFoundException,
  ValidationException,
  
  // Security
  security,
  csrf,
  
  // Testing
  TestClient,
} from './src/index';

console.log('================================================');
console.log('   CanxJS Framework Feature Verification');
console.log('================================================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then(r => {
        if (r) {
          console.log(`✅ ${name}`);
          passed++;
        } else {
          console.log(`❌ ${name}`);
          failed++;
        }
      }).catch(e => {
        console.log(`❌ ${name}: ${e.message}`);
        failed++;
      });
    } else if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (e: any) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

// ===============================================
// Core Tests
// ===============================================
console.log('\n--- Core Framework ---');
test('createApp exists', () => typeof createApp === 'function');
test('Canx class exists', () => typeof Canx === 'function');
test('defineConfig exists', () => typeof defineConfig === 'function');
test('Server class exists', () => typeof Server === 'function');
test('Router class exists', () => typeof Router === 'function');
test('MiddlewarePipeline exists', () => typeof MiddlewarePipeline === 'function');
test('cors middleware exists', () => typeof cors === 'function');
test('logger middleware exists', () => typeof logger === 'function');
test('bodyParser middleware exists', () => typeof bodyParser === 'function');
test('rateLimit middleware exists', () => typeof rateLimit === 'function');

// ===============================================
// Auth Tests
// ===============================================
console.log('\n--- Authentication ---');
test('hashPassword exists', () => typeof hashPassword === 'function');
test('verifyPassword exists', () => typeof verifyPassword === 'function');
test('signJWT exists', () => typeof signJWT === 'function');
test('verifyJWT exists', () => typeof verifyJWT === 'function');
test('jwtAuth middleware exists', () => typeof jwtAuth === 'function');
test('sessionAuth middleware exists', () => typeof sessionAuth === 'function');
test('gate exists', () => typeof gate === 'object');
test('defineGate exists', () => typeof defineGate === 'function');
test('definePolicy exists', () => typeof definePolicy === 'function');

// ===============================================
// MVC Tests
// ===============================================
console.log('\n--- MVC ---');
test('BaseController class exists', () => typeof BaseController === 'function');
test('Controller decorator exists', () => typeof Controller === 'function');
test('Get decorator exists', () => typeof Get === 'function');
test('Post decorator exists', () => typeof Post === 'function');
test('Put decorator exists', () => typeof Put === 'function');
test('Delete decorator exists', () => typeof Delete === 'function');
test('Model class exists', () => typeof Model === 'function');

// ===============================================
// Features Tests
// ===============================================
console.log('\n--- Features ---');
test('hotWire exists', () => typeof hotWire === 'object');
test('autoCache exists', () => typeof autoCache === 'object');
test('jitCompiler exists', () => typeof jitCompiler === 'object');
test('scheduler exists', () => typeof scheduler === 'object');

// ===============================================
// Database Tests
// ===============================================
console.log('\n--- Database ---');
test('Schema (migration) exists', () => typeof DbSchema === 'function');
test('seeder exists', () => typeof seeder === 'object');

// ===============================================
// Queue Tests
// ===============================================
console.log('\n--- Queue ---');
test('queue exists', () => typeof queue === 'object');

// ===============================================
// Storage Tests
// ===============================================
console.log('\n--- Storage ---');
test('storage exists', () => typeof storage === 'object');

// ===============================================
// Events Tests
// ===============================================
console.log('\n--- Events ---');
test('events exists', () => typeof events === 'object');

// ===============================================
// Utils Tests
// ===============================================
console.log('\n--- Utils ---');
test('validate exists', () => typeof validate === 'function');
test('log exists', () => typeof log === 'object');
test('hash function exists', () => typeof hash === 'function');
test('encrypt exists', () => typeof encrypt === 'function');
test('decrypt exists', () => typeof decrypt === 'function');
test('paginate exists', () => typeof paginate === 'function');
test('collect exists', () => typeof collect === 'function');
test('initI18n exists', () => typeof initI18n === 'function');

// ===============================================
// API Tests
// ===============================================
console.log('\n--- API Features ---');
test('OpenAPIBuilder exists', () => typeof OpenAPIBuilder === 'function');
test('versioning exists', () => typeof versioning === 'function');
test('Resource class exists', () => typeof Resource === 'function');

// ===============================================
// Container Tests
// ===============================================
console.log('\n--- Container/DI ---');
test('container exists', () => typeof container === 'object');
test('bind exists', () => typeof bind === 'function');
test('singleton exists', () => typeof singleton === 'function');

// ===============================================
// Exception Tests
// ===============================================
console.log('\n--- Exceptions ---');
test('CanxException exists', () => typeof CanxException === 'function');
test('HttpException exists', () => typeof HttpException === 'function');
test('NotFoundException exists', () => typeof NotFoundException === 'function');
test('ValidationException exists', () => typeof ValidationException === 'function');

// ===============================================
// Security Tests
// ===============================================
console.log('\n--- Security ---');
test('security middleware exists', () => typeof security === 'function');
test('csrf middleware exists', () => typeof csrf === 'function');

// ===============================================
// Testing Tests
// ===============================================
console.log('\n--- Testing Utilities ---');
test('TestClient exists', () => typeof TestClient === 'function');

// ===============================================
// Functional Tests
// ===============================================
console.log('\n--- Functional Tests ---');

// Test App Creation
test('Can create app', () => {
  const app = createApp({ port: 4000 });
  return app !== null && typeof app.get === 'function';
});

// Test Router
test('Router can register routes', () => {
  const router = new Router();
  router.get('/test', async (req, res) => res.json({ ok: true }));
  const routes = router.getRoutes();
  return routes.length > 0;
});

// Test Collection
test('Collection works', () => {
  const c = collect([1, 2, 3, 4, 5]);
  return c.sum() === 15 && c.avg() === 3;
});

// Test defineConfig
test('defineConfig returns same object', () => {
  const cfg = { port: 3000 };
  return defineConfig(cfg) === cfg;
});

// Summary
setTimeout(() => {
  console.log('\n================================================');
  console.log(`   Results: ${passed} passed, ${failed} failed`);
  console.log('================================================');
  
  if (failed === 0) {
    console.log('\n🎉 All features verified successfully!\n');
  } else {
    console.log('\n⚠️  Some features failed verification.\n');
  }
}, 500);
