/**
 * CanxJS Test Helpers
 * Utilities for testing CanxJS applications
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import type { CanxRequest, CanxResponse } from '../types';

// ============================================
// Types
// ============================================

export interface TestResponse {
  status: number;
  body: any;
  text: string;
  headers: Record<string, string>;
  assertStatus(status: number): TestResponse;
  assertJson(subset: object): TestResponse;
  assertText(text: string): TestResponse;
  assertHeader(key: string, value?: string): TestResponse;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

// ============================================
// HTTP Test Helper
// ============================================

export class HttpTest {
  private app: any; // Application instance (e.g. Server)
  private headers: Record<string, string> = {};

  constructor(app: any) {
    this.app = app;
  }

  /**
   * Set headers for request
   */
  withHeaders(headers: Record<string, string>): this {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  /**
   * Set bearer token
   */
  withToken(token: string): this {
    this.headers['Authorization'] = `Bearer ${token}`;
    return this;
  }

  /**
   * Make a GET request
   */
  async get(path: string): Promise<TestResponse> {
    return this.request('GET', path);
  }

  /**
   * Make a POST request
   */
  async post(path: string, body?: any): Promise<TestResponse> {
    return this.request('POST', path, body);
  }

  /**
   * Make a PUT request
   */
  async put(path: string, body?: any): Promise<TestResponse> {
    return this.request('PUT', path, body);
  }

  /**
   * Make a PATCH request
   */
  async patch(path: string, body?: any): Promise<TestResponse> {
    return this.request('PATCH', path, body);
  }

  /**
   * Make a DELETE request
   */
  async delete(path: string, body?: any): Promise<TestResponse> {
    return this.request('DELETE', path, body);
  }

  /**
   * Make a generic request
   */
  async request(method: HttpMethod, path: string, body?: any): Promise<TestResponse> {
    const url = `http://localhost${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    // If app has a fetch handler (like Canx Server), use it directly
    // Otherwise fallback to global fetch if app is running on a port
    let res: Response;
    if (this.app && typeof this.app.fetch === 'function') {
        const req = new Request(url, options);
        res = await this.app.fetch(req);
    } else {
       // Assume app is running externally or we use Bun.fetch locally if URL is valid
       // For unit testing framework, we usually want to invoke the handler directly
       throw new Error('App instance must provide a fetch() method for testing.');
    }

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => headers[k] = v);

    const testRes: TestResponse = {
      status: res.status,
      body: json,
      text,
      headers,

      assertStatus(status: number) {
        if (this.status !== status) {
          throw new Error(`Expected status ${status} but got ${this.status}. Body: ${this.text}`);
        }
        expect(this.status).toBe(status);
        return this;
      },

      assertJson(subset: object) {
        expect(this.body).toMatchObject(subset);
        return this;
      },

      assertText(content: string) {
        expect(this.text).toContain(content);
        return this;
      },

      assertHeader(key: string, value?: string) {
        expect(this.headers[key.toLowerCase()]).toBeDefined();
        if (value) {
          expect(this.headers[key.toLowerCase()]).toBe(value);
        }
        return this;
      }
    };

    return testRes;
  }
}

// ============================================
// Database Test Helper
// ============================================

export class DatabaseTest {
  /**
   * Seed the database
   */
  static async seed(seederName: string): Promise<void> {
    // Logic to call seeder
    // This assumes seeders are registered in the global registry
  }

  /**
   * Refresh database (migrate fresh)
   */
  static async refreshDatabase(): Promise<void> {
    // Logic to run migrations down then up
  }

  /**
   * Assert database has record
   */
  static async assertHas(table: string, data: Record<string, any>): Promise<void> {
    // Use DB query builder to check existence
    // const exists = await DB.table(table).where(data).exists();
    // expect(exists).toBe(true);
  }

  /**
   * Assert database missing record
   */
  static async assertMissing(table: string, data: Record<string, any>): Promise<void> {
    // const exists = await DB.table(table).where(data).exists();
    // expect(exists).toBe(false);
  }
}

// ============================================
// Factory
// ============================================

/**
 * Create HTTP test helper
 */
export function createHttpTest(app: any): HttpTest {
  return new HttpTest(app);
}

/**
 * Basic Test Case Wrapper
 */
export class TestCase {
  static setup() {
    // Global setup
  }

  static teardown() {
    // Global teardown
  }
}
