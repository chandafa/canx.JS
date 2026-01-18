import { describe, expect, test } from 'bun:test';
import {
  JsonResource,
  ResourceCollection,
  AnonymousResource,
  resource,
  collection,
  wrap,
  success,
  error,
  when,
  whenNotNull,
  whenLoaded,
  mergeWhen,
} from '../src/utils/Resource';
import { Paginator } from '../src/utils/Paginator';

// ============================================
// Test Resource Classes
// ============================================

interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role?: string;
  created_at?: string;
  posts?: { id: number; title: string }[];
}

class UserResource extends JsonResource<User> {
  toArray(): Record<string, unknown> {
    return {
      id: this.resource.id,
      name: this.resource.name,
      email: this.resource.email,
      role: when(this.resource.role !== undefined, this.resource.role),
      created_at: whenNotNull(this.resource.created_at),
    };
  }
}

class UserWithPostsResource extends JsonResource<User> {
  toArray(): Record<string, unknown> {
    return {
      id: this.resource.id,
      name: this.resource.name,
      posts: whenLoaded('posts', this.resource, () =>
        this.resource.posts?.map(p => ({ id: p.id, title: p.title }))
      ),
    };
  }
}

// ============================================
// Tests
// ============================================

describe('JsonResource', () => {
  describe('Basic Transformation', () => {
    test('should transform resource to array', () => {
      const user: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
      };

      const resource = new UserResource(user);
      const result = resource.toArray();

      expect(result.id).toBe(1);
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.password).toBeUndefined(); // Not included
    });

    test('should get underlying resource', () => {
      const user: User = { id: 1, name: 'John', email: 'john@test.com' };
      const resource = new UserResource(user);

      expect(resource.getResource()).toEqual(user);
    });
  });

  describe('toJSON', () => {
    test('should wrap data in response format', () => {
      const user: User = { id: 1, name: 'John', email: 'john@test.com' };
      const resource = new UserResource(user);
      const json = resource.toJSON();

      expect(json.data).toBeDefined();
      expect(json.data.id).toBe(1);
    });

    test('should include additional meta', () => {
      const user: User = { id: 1, name: 'John', email: 'john@test.com' };
      const resource = new UserResource(user).additional({ version: '1.0' });
      const json = resource.toJSON();

      expect(json.meta?.version).toBe('1.0');
    });

    test('should include additional links', () => {
      const user: User = { id: 1, name: 'John', email: 'john@test.com' };
      const resource = new UserResource(user).withLinks({ self: '/users/1' });
      const json = resource.toJSON();

      expect(json.links?.self).toBe('/users/1');
    });

    test('should support without wrapping', () => {
      const user: User = { id: 1, name: 'John', email: 'john@test.com' };
      const resource = new UserResource(user).withoutWrappingData();
      const json = resource.toJSON();

      expect(json.id).toBe(1);
      expect((json as any).data).toBeUndefined();
    });
  });
});

describe('ResourceCollection', () => {
  test('should transform array of items', () => {
    const users: User[] = [
      { id: 1, name: 'John', email: 'john@test.com' },
      { id: 2, name: 'Jane', email: 'jane@test.com' },
    ];

    const col = new ResourceCollection(UserResource, users);
    const json = col.toJSON();

    expect(json.data.length).toBe(2);
    expect(json.data[0].id).toBe(1);
    expect(json.data[1].id).toBe(2);
  });

  test('should support pagination', () => {
    const users: User[] = [
      { id: 1, name: 'John', email: 'john@test.com' },
      { id: 2, name: 'Jane', email: 'jane@test.com' },
    ];

    const paginator = new Paginator(users, 10, 1, '/users');
    const col = new ResourceCollection(UserResource, paginator);
    const json = col.toJSON();

    expect(json.data.length).toBe(2);
    expect(json.meta?.total).toBe(10);
    expect(json.meta?.currentPage).toBe(1); // camelCase from Paginator
    expect(json.links?.first).toBeDefined();
  });

  test('should include additional meta', () => {
    const users: User[] = [{ id: 1, name: 'John', email: 'john@test.com' }];
    const col = new ResourceCollection(UserResource, users).additional({ count: 1 });
    const json = col.toJSON();

    expect(json.meta?.count).toBe(1);
  });

  test('should use static collection method', () => {
    const users: User[] = [{ id: 1, name: 'John', email: 'john@test.com' }];
    const col = JsonResource.collection(UserResource, users);
    const json = col.toJSON();

    expect(json.data.length).toBe(1);
  });
});

describe('AnonymousResource', () => {
  test('should transform with inline function', () => {
    const user = { id: 1, name: 'John', email: 'john@test.com' };
    const res = new AnonymousResource(user, (u) => ({
      id: u.id,
      display_name: u.name.toUpperCase(),
    }));

    const result = res.toArray();
    expect(result.id).toBe(1);
    expect(result.display_name).toBe('JOHN');
  });
});

describe('Helper Functions', () => {
  describe('resource()', () => {
    test('should create anonymous resource', () => {
      const data = { id: 1, value: 'test' };
      const res = resource(data, (d) => ({ id: d.id, v: d.value }));
      const json = res.toJSON();

      expect(json.data.id).toBe(1);
      expect(json.data.v).toBe('test');
    });
  });

  describe('collection()', () => {
    test('should create resource collection', () => {
      const items: User[] = [{ id: 1, name: 'John', email: 'john@test.com' }];
      const col = collection(UserResource, items);
      const json = col.toJSON();

      expect(json.data.length).toBe(1);
    });
  });

  describe('wrap()', () => {
    test('should wrap data in response format', () => {
      const result = wrap({ message: 'Hello' });
      expect(result.data).toEqual({ message: 'Hello' });
    });

    test('should include meta if provided', () => {
      const result = wrap({ message: 'Hello' }, { version: '1.0' });
      expect(result.meta?.version).toBe('1.0');
    });
  });

  describe('success()', () => {
    test('should create success response', () => {
      const result = success({ id: 1 }, 'Created');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1 });
      expect(result.message).toBe('Created');
    });
  });

  describe('error()', () => {
    test('should create error response', () => {
      const result = error('Validation failed', { email: ['Invalid email'] });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.errors?.email).toContain('Invalid email');
    });
  });
});

describe('Conditional Helpers', () => {
  describe('when()', () => {
    test('should return value when condition is true', () => {
      expect(when(true, 'yes')).toBe('yes');
    });

    test('should return undefined when condition is false', () => {
      expect(when(false, 'no')).toBeUndefined();
    });

    test('should support function value', () => {
      expect(when(true, () => 'computed')).toBe('computed');
    });
  });

  describe('whenNotNull()', () => {
    test('should return value when not null', () => {
      expect(whenNotNull('value')).toBe('value');
    });

    test('should return undefined when null', () => {
      expect(whenNotNull(null)).toBeUndefined();
    });

    test('should return undefined when undefined', () => {
      expect(whenNotNull(undefined)).toBeUndefined();
    });
  });

  describe('whenLoaded()', () => {
    test('should return value when relation is loaded', () => {
      const resource = { posts: [{ id: 1 }] };
      expect(whenLoaded('posts', resource, [{ id: 1 }])).toEqual([{ id: 1 }]);
    });

    test('should return undefined when relation not loaded', () => {
      const resource = { name: 'John' };
      expect(whenLoaded('posts', resource, [])).toBeUndefined();
    });
  });

  describe('mergeWhen()', () => {
    test('should merge when condition is true', () => {
      const result = mergeWhen(true, { extra: 'data' });
      expect(result).toEqual({ extra: 'data' });
    });

    test('should return empty when condition is false', () => {
      const result = mergeWhen(false, { extra: 'data' });
      expect(result).toEqual({});
    });
  });
});
