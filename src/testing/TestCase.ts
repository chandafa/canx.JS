/**
 * CanxJS Testing Utilities - Base test case and helpers
 */

// ============================================
// Types
// ============================================

export interface TestResponse {
  status: number;
  headers: Headers;
  body: unknown;
  text: () => Promise<string>;
  json: <T = unknown>() => Promise<T>;
}

export interface TestRequest {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}

// ============================================
// HTTP Testing Client
// ============================================

export class TestClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string> = {};
  private cookies: Map<string, string> = new Map();

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Set default headers for all requests
   */
  withHeaders(headers: Record<string, string>): this {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
    return this;
  }

  /**
   * Set authorization header
   */
  withToken(token: string, type: string = 'Bearer'): this {
    this.defaultHeaders['Authorization'] = `${type} ${token}`;
    return this;
  }

  /**
   * Set a cookie
   */
  withCookie(name: string, value: string): this {
    this.cookies.set(name, value);
    return this;
  }

  /**
   * Make a GET request
   */
  async get(path: string, query?: Record<string, string>): Promise<TestResponse> {
    return this.request({ method: 'GET', path, query });
  }

  /**
   * Make a POST request
   */
  async post(path: string, body?: unknown): Promise<TestResponse> {
    return this.request({ method: 'POST', path, body });
  }

  /**
   * Make a PUT request
   */
  async put(path: string, body?: unknown): Promise<TestResponse> {
    return this.request({ method: 'PUT', path, body });
  }

  /**
   * Make a PATCH request
   */
  async patch(path: string, body?: unknown): Promise<TestResponse> {
    return this.request({ method: 'PATCH', path, body });
  }

  /**
   * Make a DELETE request
   */
  async delete(path: string): Promise<TestResponse> {
    return this.request({ method: 'DELETE', path });
  }

  /**
   * Make a request
   */
  async request(req: TestRequest): Promise<TestResponse> {
    let url = `${this.baseUrl}${req.path}`;
    
    if (req.query) {
      const params = new URLSearchParams(req.query);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...req.headers,
    };

    // Add cookies
    if (this.cookies.size > 0) {
      headers['Cookie'] = Array.from(this.cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }

    // Add content-type for JSON body
    if (req.body && typeof req.body === 'object') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
    });

    // Store cookies from response
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/^([^=]+)=([^;]+)/);
      if (match) {
        this.cookies.set(match[1], match[2]);
      }
    }

    const bodyBuffer = await response.arrayBuffer();
    const bodyText = new TextDecoder().decode(bodyBuffer);

    return {
      status: response.status,
      headers: response.headers,
      body: bodyText,
      text: async () => bodyText,
      json: async <T>() => JSON.parse(bodyText) as T,
    };
  }
}

// ============================================
// Assertions
// ============================================

export class ResponseAssertions {
  constructor(private response: TestResponse) {}

  /**
   * Assert status code
   */
  assertStatus(expected: number): this {
    if (this.response.status !== expected) {
      throw new Error(`Expected status ${expected}, got ${this.response.status}`);
    }
    return this;
  }

  /**
   * Assert successful response (2xx)
   */
  assertSuccessful(): this {
    if (this.response.status < 200 || this.response.status >= 300) {
      throw new Error(`Expected successful response, got ${this.response.status}`);
    }
    return this;
  }

  /**
   * Assert OK response (200)
   */
  assertOk(): this {
    return this.assertStatus(200);
  }

  /**
   * Assert created response (201)
   */
  assertCreated(): this {
    return this.assertStatus(201);
  }

  /**
   * Assert no content response (204)
   */
  assertNoContent(): this {
    return this.assertStatus(204);
  }

  /**
   * Assert not found response (404)
   */
  assertNotFound(): this {
    return this.assertStatus(404);
  }

  /**
   * Assert unauthorized response (401)
   */
  assertUnauthorized(): this {
    return this.assertStatus(401);
  }

  /**
   * Assert forbidden response (403)
   */
  assertForbidden(): this {
    return this.assertStatus(403);
  }

  /**
   * Assert unprocessable entity (422)
   */
  assertUnprocessable(): this {
    return this.assertStatus(422);
  }

  /**
   * Assert header exists
   */
  assertHeader(name: string, value?: string): this {
    const actual = this.response.headers.get(name);
    if (actual === null) {
      throw new Error(`Expected header "${name}" to exist`);
    }
    if (value !== undefined && actual !== value) {
      throw new Error(`Expected header "${name}" to be "${value}", got "${actual}"`);
    }
    return this;
  }

  /**
   * Assert JSON structure
   */
  async assertJson(expected: Record<string, unknown>): Promise<this> {
    const actual = await this.response.json();
    for (const [key, value] of Object.entries(expected)) {
      if ((actual as any)[key] !== value) {
        throw new Error(
          `Expected JSON key "${key}" to be ${JSON.stringify(value)}, got ${JSON.stringify((actual as any)[key])}`
        );
      }
    }
    return this;
  }

  /**
   * Assert JSON has keys
   */
  async assertJsonHasKeys(...keys: string[]): Promise<this> {
    const actual = await this.response.json();
    for (const key of keys) {
      if (!(key in (actual as object))) {
        throw new Error(`Expected JSON to have key "${key}"`);
      }
    }
    return this;
  }

  /**
   * Assert JSON path value
   */
  async assertJsonPath(path: string, expected: unknown): Promise<this> {
    const actual = await this.response.json();
    const value = path.split('.').reduce((obj, key) => (obj as any)?.[key], actual);
    if (value !== expected) {
      throw new Error(`Expected JSON path "${path}" to be ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    }
    return this;
  }

  /**
   * Assert body contains text
   */
  async assertBodyContains(text: string): Promise<this> {
    const body = await this.response.text();
    if (!body.includes(text)) {
      throw new Error(`Expected body to contain "${text}"`);
    }
    return this;
  }
}

// ============================================
// Mock Factory
// ============================================

export class MockFactory<T extends Record<string, unknown>> {
  private definition: () => T;
  private states: Map<string, Partial<T>> = new Map();

  constructor(definition: () => T) {
    this.definition = definition;
  }

  /**
   * Define a state
   */
  state(name: string, attributes: Partial<T>): this {
    this.states.set(name, attributes);
    return this;
  }

  /**
   * Create a single instance
   */
  make(overrides: Partial<T> = {}, states: string[] = []): T {
    let data = this.definition();
    
    for (const stateName of states) {
      const stateData = this.states.get(stateName);
      if (stateData) {
        data = { ...data, ...stateData };
      }
    }

    return { ...data, ...overrides };
  }

  /**
   * Create multiple instances
   */
  makeMany(count: number, overrides: Partial<T> = {}, states: string[] = []): T[] {
    return Array.from({ length: count }, () => this.make(overrides, states));
  }

  /**
   * Create with specific state
   */
  withState(name: string): { make: (overrides?: Partial<T>) => T; makeMany: (count: number, overrides?: Partial<T>) => T[] } {
    return {
      make: (overrides = {}) => this.make(overrides, [name]),
      makeMany: (count, overrides = {}) => this.makeMany(count, overrides, [name]),
    };
  }
}

// ============================================
// Test Helpers
// ============================================

/**
 * Create a test client
 */
export function createTestClient(baseUrl?: string): TestClient {
  return new TestClient(baseUrl);
}

/**
 * Create response assertions
 */
export function assertResponse(response: TestResponse): ResponseAssertions {
  return new ResponseAssertions(response);
}

/**
 * Create a mock factory
 */
export function factory<T extends Record<string, unknown>>(definition: () => T): MockFactory<T> {
  return new MockFactory(definition);
}

/**
 * Generate random string
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generate random email
 */
export function randomEmail(): string {
  return `${randomString(8)}@test.example.com`;
}

/**
 * Generate random number
 */
export function randomNumber(min: number = 0, max: number = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random UUID
 */
export function randomUuid(): string {
  return crypto.randomUUID();
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Exports
// ============================================

export default {
  TestClient,
  ResponseAssertions,
  MockFactory,
  createTestClient,
  assertResponse,
  factory,
  randomString,
  randomEmail,
  randomNumber,
  randomUuid,
  sleep,
};
