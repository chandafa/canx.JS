import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { 
  FormRequest, 
  formRequest, 
  validated, 
  getFormRequest, 
  createFormRequest,
  ValidateWith
} from '../src/utils/FormRequest';
import type { ValidationSchema } from '../src/types';

// ============================================
// Test FormRequest Classes
// ============================================

class StoreUserRequest extends FormRequest {
  authorize(): boolean {
    return true;
  }

  rules(): ValidationSchema {
    return {
      name: 'required|string|min:3',
      email: 'required|email',
      age: 'number|min:18',
    };
  }

  messages(): Record<string, string> {
    return {
      'name.required': 'Name is required!',
    };
  }
}

class AuthorizedOnlyRequest extends FormRequest {
  authorize(): boolean {
    return this.user !== null && (this.user as any).role === 'admin';
  }

  rules(): ValidationSchema {
    return {
      title: 'required|string',
    };
  }
}

class PrepareDataRequest extends FormRequest {
  authorize(): boolean {
    return true;
  }

  rules(): ValidationSchema {
    return {
      slug: 'required|string',
    };
  }

  prepareForValidation(data: Record<string, unknown>): Record<string, unknown> {
    // Auto-generate slug from title if not provided
    if (data.title && !data.slug) {
      data.slug = String(data.title).toLowerCase().replace(/\s+/g, '-');
    }
    return data;
  }
}

// ============================================
// Tests
// ============================================

describe('FormRequest', () => {
  describe('Basic Validation', () => {
    test('should validate data using rules', async () => {
      const request = new StoreUserRequest();
      
      const result = await request.validate({
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
      });

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
      });
    });

    test('should fail validation with invalid data', async () => {
      const request = new StoreUserRequest();
      
      const result = await request.validate({
        name: 'Jo', // Too short
        email: 'invalid-email',
        age: 16, // Under 18
      });

      expect(result.valid).toBe(false);
      expect(result.errors.size).toBeGreaterThan(0);
    });

    test('should fail when required fields are missing', async () => {
      const request = new StoreUserRequest();
      
      const result = await request.validate({});

      expect(result.valid).toBe(false);
      expect(result.errors.has('name')).toBe(true);
      expect(result.errors.has('email')).toBe(true);
    });
  });

  describe('Authorization', () => {
    test('should authorize when condition is met', async () => {
      const request = new AuthorizedOnlyRequest();
      (request as any).user = { id: 1, role: 'admin' };

      const authorized = await request.checkAuthorization();
      expect(authorized).toBe(true);
    });

    test('should deny when not authorized', async () => {
      const request = new AuthorizedOnlyRequest();
      (request as any).user = { id: 1, role: 'user' };

      const authorized = await request.checkAuthorization();
      expect(authorized).toBe(false);
    });

    test('should deny when user is null', async () => {
      const request = new AuthorizedOnlyRequest();
      (request as any).user = null;

      const authorized = await request.checkAuthorization();
      expect(authorized).toBe(false);
    });
  });

  describe('Data Helpers', () => {
    test('validated() should return all validated data', async () => {
      const request = new StoreUserRequest();
      await request.validate({
        name: 'John Doe',
        email: 'john@test.com',
        age: 30,
      });

      const data = request.validated<{ name: string; email: string; age: number }>();
      expect(data.name).toBe('John Doe');
      expect(data.email).toBe('john@test.com');
      expect(data.age).toBe(30);
    });

    test('safe() should return specific field with default', async () => {
      const request = new StoreUserRequest();
      await request.validate({
        name: 'John',
        email: 'john@test.com',
      });

      expect(request.safe('name')).toBe('John');
      expect(request.safe('missing', 'default')).toBe('default');
    });

    test('only() should return only specified fields', async () => {
      const request = new StoreUserRequest();
      await request.validate({
        name: 'John',
        email: 'john@test.com',
        age: 25,
      });

      const subset = request.only('name', 'email');
      expect(subset).toEqual({ name: 'John', email: 'john@test.com' });
      expect(Object.keys(subset)).not.toContain('age');
    });

    test('except() should return all except specified fields', async () => {
      const request = new StoreUserRequest();
      await request.validate({
        name: 'John',
        email: 'john@test.com',
        age: 25,
      });

      const subset = request.except('age');
      expect(subset).toEqual({ name: 'John', email: 'john@test.com' });
      expect(Object.keys(subset)).not.toContain('age');
    });

    test('has() should check if field exists', async () => {
      const request = new StoreUserRequest();
      await request.validate({
        name: 'John',
        email: 'john@test.com',
      });

      expect(request.has('name')).toBe(true);
      expect(request.has('missing')).toBe(false);
    });

    test('all() should return all validated data', async () => {
      const request = new StoreUserRequest();
      await request.validate({
        name: 'John',
        email: 'john@test.com',
      });

      expect(request.all()).toEqual({ name: 'John', email: 'john@test.com' });
    });
  });

  describe('prepareForValidation', () => {
    test('should prepare data before validation', async () => {
      const request = new PrepareDataRequest();
      
      const result = await request.validate({
        title: 'Hello World',
        // slug will be auto-generated
      });

      expect(result.valid).toBe(true);
      expect(result.data.slug).toBe('hello-world');
    });
  });

  describe('createFormRequest Factory', () => {
    test('should create FormRequest from rules object', async () => {
      const SimpleRequest = createFormRequest({
        username: 'required|string',
        password: 'required|string|min:6',
      });

      const request = new SimpleRequest();
      const result = await request.validate({
        username: 'johndoe',
        password: 'secret123',
      });

      expect(result.valid).toBe(true);
    });

    test('should support custom authorize function', async () => {
      const AdminRequest = createFormRequest(
        { title: 'required' },
        { authorize: (user) => user !== null }
      );

      const request = new AdminRequest();
      (request as any).user = null;

      const authorized = await request.checkAuthorization();
      expect(authorized).toBe(false);
    });
  });
});
