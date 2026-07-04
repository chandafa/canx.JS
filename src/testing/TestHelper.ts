/**
 * CanxJS Test Helpers
 * Utilities for testing CanxJS applications
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import type { CanxRequest, CanxResponse } from '../types';
import { QueryBuilderImpl, beginTransaction, rollBack } from '../mvc/Model';
import { actAsUser, stopActingAs } from '../auth/Guard';

// ============================================
// Types
// ============================================

export interface HttpTestResponse {
  status: number;
  body: any;
  text: string;
  headers: Record<string, string>;
  assertStatus(status: number): HttpTestResponse;
  assertJson(subset: object): HttpTestResponse;
  assertText(text: string): HttpTestResponse;
  assertHeader(key: string, value?: string): HttpTestResponse;
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
   * Authenticate as the given user for subsequent requests (Laravel actingAs).
   * Bypasses the real guards — the auth middleware resolves this user directly.
   * Call logout() (or stopActingAs) to clear.
   */
  actingAs(user: any): this {
    actAsUser(user);
    return this;
  }

  /** Stop impersonating (clear actingAs). */
  logout(): this {
    stopActingAs();
    return this;
  }

  /**
   * Make a GET request
   */
  async get(path: string): Promise<HttpTestResponse> {
    return this.request('GET', path);
  }

  /**
   * Make a POST request
   */
  async post(path: string, body?: any): Promise<HttpTestResponse> {
    return this.request('POST', path, body);
  }

  /**
   * Make a PUT request
   */
  async put(path: string, body?: any): Promise<HttpTestResponse> {
    return this.request('PUT', path, body);
  }

  /**
   * Make a PATCH request
   */
  async patch(path: string, body?: any): Promise<HttpTestResponse> {
    return this.request('PATCH', path, body);
  }

  /**
   * Make a DELETE request
   */
  async delete(path: string, body?: any): Promise<HttpTestResponse> {
    return this.request('DELETE', path, body);
  }

  /**
   * Make a generic request
   */
  async request(method: HttpMethod, path: string, body?: any): Promise<HttpTestResponse> {
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

    const testRes: HttpTestResponse = {
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
  // Build a table query filtered by an equality map.
  private static queryFor(table: string, data: Record<string, any>) {
    let q = new QueryBuilderImpl<any>(table);
    for (const [k, v] of Object.entries(data)) {
      q = v === null ? (q as any).whereNull(k) : (q as any).where(k, '=', v);
    }
    return q;
  }

  /**
   * Run a seeder (an instance with a `run()` method, or a plain function).
   */
  static async seed(seeder: { run: () => Promise<void> | void } | (() => Promise<void> | void)): Promise<void> {
    if (typeof seeder === 'function') await seeder();
    else if (seeder && typeof seeder.run === 'function') await seeder.run();
  }

  /**
   * Wrap every test in a transaction that is rolled back afterwards, giving each
   * test a clean database without re-migrating. Call inside a describe() block.
   * Optionally pass a one-time schema/seed setup to run in beforeAll.
   */
  static refreshDatabase(setup?: () => Promise<void> | void): void {
    if (setup) beforeAll(async () => { await setup(); });
    beforeEach(async () => { await beginTransaction(); });
    afterEach(async () => { await rollBack(); });
  }

  /** Assert the table contains at least one row matching `data`. */
  static async assertHas(table: string, data: Record<string, any>): Promise<void> {
    const exists = await (this.queryFor(table, data) as any).exists();
    if (!exists) throw new Error(`Failed asserting that table [${table}] contains ${JSON.stringify(data)}`);
    expect(exists).toBe(true);
  }

  /** Assert the table contains NO row matching `data`. */
  static async assertMissing(table: string, data: Record<string, any>): Promise<void> {
    const exists = await (this.queryFor(table, data) as any).exists();
    if (exists) throw new Error(`Failed asserting that table [${table}] is missing ${JSON.stringify(data)}`);
    expect(exists).toBe(false);
  }

  /** Assert an exact row count (optionally filtered by `data`). */
  static async assertCount(table: string, count: number, data: Record<string, any> = {}): Promise<void> {
    const actual = await (this.queryFor(table, data) as any).count();
    expect(actual).toBe(count);
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
