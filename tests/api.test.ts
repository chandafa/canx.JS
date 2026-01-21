/**
 * Phase 3: API Excellence Verification Tests
 */

import { expect, test, describe } from "bun:test";

// Import Phase 3 modules
import { 
  versioning,
  versionedHandler,
  Version,
  getVersion,
  urlVersioning,
  headerVersioning,
} from '../src/utils/ApiVersioning';

import { 
  OpenAPIBuilder,
  createOpenAPI,
  Schemas,
  ApiDoc,
  getApiDoc,
} from '../src/generator/OpenAPIGenerator';

import { 
  Resource,
  ResourceCollection,
  paginatedResource,
  when,
  whenNotNull,
  mergeWhen,
} from '../src/utils/ApiResource';

// ============================================
// API Versioning Tests
// ============================================

describe('API Versioning', () => {
  
  test('versioning middleware creates function', () => {
    const middleware = versioning({ type: 'url', default: '1' });
    expect(typeof middleware).toBe('function');
  });

  test('versionedHandler routes to correct handler', async () => {
    const handler = versionedHandler({
      '1': async (req, res) => res.json({ version: 1 }),
      '2': async (req, res) => res.json({ version: 2 }),
    });
    expect(typeof handler).toBe('function');
  });

  test('Version decorator stores metadata', () => {
    class TestController {
      @Version('2')
      getUsers() {}
    }
    
    const controller = new TestController();
    const version = getVersion(controller, 'getUsers');
    expect(version).toBe('2');
  });

  test('urlVersioning creates URL-based middleware', () => {
    const middleware = urlVersioning(['1', '2', '3']);
    expect(typeof middleware).toBe('function');
  });

  test('headerVersioning creates header-based middleware', () => {
    const middleware = headerVersioning(['1', '2']);
    expect(typeof middleware).toBe('function');
  });
});

// ============================================
// OpenAPI Generator Tests
// ============================================

describe('OpenAPI Generator', () => {
  
  test('createOpenAPI returns builder', () => {
    const builder = createOpenAPI({
      info: { title: 'Test API', version: '1.0.0' },
    });
    expect(builder).toBeInstanceOf(OpenAPIBuilder);
  });

  test('OpenAPIBuilder adds routes', () => {
    const builder = createOpenAPI({
      info: { title: 'Test API', version: '1.0.0' },
    });
    
    builder.addRoute({
      path: '/users',
      method: 'GET',
      summary: 'List users',
      tags: ['Users'],
    });
    
    const doc = builder.build();
    expect(doc.paths).toBeDefined();
    expect((doc.paths as any)['/users']).toBeDefined();
    expect((doc.paths as any)['/users'].get.summary).toBe('List users');
  });

  test('OpenAPIBuilder generates valid spec', () => {
    const builder = createOpenAPI({
      info: { title: 'My API', version: '2.0.0', description: 'Test' },
      servers: [{ url: 'http://localhost:3000' }],
    });
    
    builder.addBearerAuth();
    builder.addSchema('User', Schemas.object({
      id: Schemas.integer(),
      name: Schemas.string(),
      email: Schemas.string({ format: 'email' }),
    }));
    
    const doc = builder.build();
    
    expect(doc.openapi).toBe('3.0.0');
    expect((doc.info as any).title).toBe('My API');
    expect((doc.info as any).version).toBe('2.0.0');
    expect((doc.servers as any)[0].url).toBe('http://localhost:3000');
    expect((doc.components as any).securitySchemes.bearerAuth).toBeDefined();
    expect((doc.components as any).schemas.User).toBeDefined();
  });

  test('OpenAPIBuilder converts path params', () => {
    const builder = createOpenAPI({
      info: { title: 'Test', version: '1.0.0' },
    });
    
    builder.addRoute({
      path: '/users/:id',
      method: 'GET',
      summary: 'Get user',
    });
    
    const doc = builder.build();
    expect((doc.paths as any)['/users/{id}']).toBeDefined();
  });

  test('Schemas helpers create correct types', () => {
    const str = Schemas.string({ minLength: 1 });
    expect(str.type).toBe('string');
    expect(str.minLength).toBe(1);
    
    const num = Schemas.number({ minimum: 0 });
    expect(num.type).toBe('number');
    expect(num.minimum).toBe(0);
    
    const arr = Schemas.array(Schemas.string());
    expect(arr.type).toBe('array');
    expect(arr.items?.type).toBe('string');
    
    const obj = Schemas.object({ name: Schemas.string() }, ['name']);
    expect(obj.type).toBe('object');
    expect(obj.properties?.name.type).toBe('string');
    expect(obj.required).toContain('name');
    
    const ref = Schemas.ref('User');
    expect(ref.$ref).toBe('#/components/schemas/User');
  });

  test('toJSON returns string', () => {
    const builder = createOpenAPI({
      info: { title: 'Test', version: '1.0.0' },
    });
    const json = builder.toJSON();
    expect(typeof json).toBe('string');
    expect(JSON.parse(json)).toBeDefined();
  });

  test('ApiDoc decorator stores documentation', () => {
    class TestController {
      @ApiDoc({ summary: 'Get all users', tags: ['Users'] })
      list() {}
    }
    
    const controller = new TestController();
    const doc = getApiDoc(controller, 'list');
    expect(doc?.summary).toBe('Get all users');
    expect(doc?.tags).toContain('Users');
  });
});

// ============================================
// API Resources Tests
// ============================================

describe('API Resources', () => {
  
  // Mock data
  interface User {
    id: number;
    name: string;
    email: string;
    password: string;
    created_at: string;
  }

  class UserResource extends Resource<User> {
    toArray() {
      return {
        id: this.resource.id,
        name: this.resource.name,
        email: this.resource.email,
        createdAt: this.resource.created_at,
        // Password is not exposed
      };
    }
  }

  const testUser: User = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    password: 'secret123',
    created_at: '2024-01-01',
  };

  test('Resource transforms single item', () => {
    const resource = new UserResource(testUser);
    const result = resource.toJSON();
    
    expect(result.id).toBe(1);
    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
    expect(result.createdAt).toBe('2024-01-01');
    expect(result.password).toBeUndefined();
  });

  test('Resource.response wraps data', () => {
    const resource = new UserResource(testUser);
    const result = resource.response();
    
    expect(result.data).toBeDefined();
    expect((result.data as any).id).toBe(1);
  });

  test('Resource.response without wrap', () => {
    const resource = new UserResource(testUser);
    const result = resource.response(false);
    
    expect(result.id).toBe(1);
    expect(result.data).toBeUndefined();
  });

  test('Resource.exclude removes fields', () => {
    const resource = new UserResource(testUser);
    const result = resource.exclude('email').toJSON();
    
    expect(result.id).toBe(1);
    expect(result.email).toBeUndefined();
  });

  test('ResourceCollection transforms array', () => {
    const users = [testUser, { ...testUser, id: 2, name: 'Jane' }];
    const collection = new ResourceCollection(users, UserResource);
    const result = collection.toArray();
    
    expect(result.length).toBe(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
    expect(result[1].name).toBe('Jane');
  });

  test('ResourceCollection with pagination', () => {
    const users = [testUser];
    const collection = new ResourceCollection(users, UserResource);
    collection.withPagination({
      currentPage: 1,
      lastPage: 5,
      perPage: 10,
      total: 50,
      from: 1,
      to: 10,
    });
    
    const result = collection.response();
    expect(result.data).toBeDefined();
    expect(result.meta).toBeDefined();
    expect((result.meta as any).pagination.total).toBe(50);
  });

  test('paginatedResource creates full response', () => {
    const result = paginatedResource(
      {
        data: [testUser],
        currentPage: 1,
        lastPage: 5,
        perPage: 10,
        total: 50,
      },
      UserResource,
      '/api/users'
    );
    
    expect(result.data).toBeDefined();
    expect(result.meta).toBeDefined();
    expect((result.meta as any).pagination.total).toBe(50);
    expect((result.meta as any).links.first).toBe('/api/users?page=1');
    expect((result.meta as any).links.last).toBe('/api/users?page=5');
  });

  test('when helper works correctly', () => {
    expect(when(true, 'value')).toBe('value');
    expect(when(false, 'value')).toBeUndefined();
    expect(when(false, 'value', 'fallback')).toBe('fallback');
  });

  test('whenNotNull helper works correctly', () => {
    expect(whenNotNull('value')).toBe('value');
    expect(whenNotNull(null)).toBeUndefined();
    expect(whenNotNull(undefined)).toBeUndefined();
  });

  test('mergeWhen helper works correctly', () => {
    const result1 = mergeWhen(true, { extra: 'data' });
    expect(result1.extra).toBe('data');
    
    const result2 = mergeWhen(false, { extra: 'data' });
    expect(Object.keys(result2).length).toBe(0);
  });
});

// ============================================
// Summary
// ============================================

describe('Phase 3 Summary', () => {
  test('All Phase 3 modules are importable', () => {
    expect(versioning).toBeDefined();
    expect(OpenAPIBuilder).toBeDefined();
    expect(Resource).toBeDefined();
  });
});
