"use strict";
/**
 * CanxJS Testing Utilities - Base test case and helpers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockFactory = exports.ResponseAssertions = exports.TestClient = void 0;
exports.createTestClient = createTestClient;
exports.assertResponse = assertResponse;
exports.factory = factory;
exports.randomString = randomString;
exports.randomEmail = randomEmail;
exports.randomNumber = randomNumber;
exports.randomUuid = randomUuid;
exports.sleep = sleep;
// ============================================
// HTTP Testing Client
// ============================================
class TestClient {
    baseUrl;
    defaultHeaders = {};
    cookies = new Map();
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
    }
    /**
     * Set default headers for all requests
     */
    withHeaders(headers) {
        this.defaultHeaders = { ...this.defaultHeaders, ...headers };
        return this;
    }
    /**
     * Set authorization header
     */
    withToken(token, type = 'Bearer') {
        this.defaultHeaders['Authorization'] = `${type} ${token}`;
        return this;
    }
    /**
     * Set a cookie
     */
    withCookie(name, value) {
        this.cookies.set(name, value);
        return this;
    }
    /**
     * Make a GET request
     */
    async get(path, query) {
        return this.request({ method: 'GET', path, query });
    }
    /**
     * Make a POST request
     */
    async post(path, body) {
        return this.request({ method: 'POST', path, body });
    }
    /**
     * Make a PUT request
     */
    async put(path, body) {
        return this.request({ method: 'PUT', path, body });
    }
    /**
     * Make a PATCH request
     */
    async patch(path, body) {
        return this.request({ method: 'PATCH', path, body });
    }
    /**
     * Make a DELETE request
     */
    async delete(path) {
        return this.request({ method: 'DELETE', path });
    }
    /**
     * Make a request
     */
    async request(req) {
        let url = `${this.baseUrl}${req.path}`;
        if (req.query) {
            const params = new URLSearchParams(req.query);
            url += `?${params.toString()}`;
        }
        const headers = {
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
            json: async () => JSON.parse(bodyText),
        };
    }
}
exports.TestClient = TestClient;
// ============================================
// Assertions
// ============================================
class ResponseAssertions {
    response;
    constructor(response) {
        this.response = response;
    }
    /**
     * Assert status code
     */
    assertStatus(expected) {
        if (this.response.status !== expected) {
            throw new Error(`Expected status ${expected}, got ${this.response.status}`);
        }
        return this;
    }
    /**
     * Assert successful response (2xx)
     */
    assertSuccessful() {
        if (this.response.status < 200 || this.response.status >= 300) {
            throw new Error(`Expected successful response, got ${this.response.status}`);
        }
        return this;
    }
    /**
     * Assert OK response (200)
     */
    assertOk() {
        return this.assertStatus(200);
    }
    /**
     * Assert created response (201)
     */
    assertCreated() {
        return this.assertStatus(201);
    }
    /**
     * Assert no content response (204)
     */
    assertNoContent() {
        return this.assertStatus(204);
    }
    /**
     * Assert not found response (404)
     */
    assertNotFound() {
        return this.assertStatus(404);
    }
    /**
     * Assert unauthorized response (401)
     */
    assertUnauthorized() {
        return this.assertStatus(401);
    }
    /**
     * Assert forbidden response (403)
     */
    assertForbidden() {
        return this.assertStatus(403);
    }
    /**
     * Assert unprocessable entity (422)
     */
    assertUnprocessable() {
        return this.assertStatus(422);
    }
    /**
     * Assert header exists
     */
    assertHeader(name, value) {
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
    async assertJson(expected) {
        const actual = await this.response.json();
        for (const [key, value] of Object.entries(expected)) {
            if (actual[key] !== value) {
                throw new Error(`Expected JSON key "${key}" to be ${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}`);
            }
        }
        return this;
    }
    /**
     * Assert JSON has keys
     */
    async assertJsonHasKeys(...keys) {
        const actual = await this.response.json();
        for (const key of keys) {
            if (!(key in actual)) {
                throw new Error(`Expected JSON to have key "${key}"`);
            }
        }
        return this;
    }
    /**
     * Assert JSON path value
     */
    async assertJsonPath(path, expected) {
        const actual = await this.response.json();
        const value = path.split('.').reduce((obj, key) => obj?.[key], actual);
        if (value !== expected) {
            throw new Error(`Expected JSON path "${path}" to be ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
        }
        return this;
    }
    /**
     * Assert body contains text
     */
    async assertBodyContains(text) {
        const body = await this.response.text();
        if (!body.includes(text)) {
            throw new Error(`Expected body to contain "${text}"`);
        }
        return this;
    }
}
exports.ResponseAssertions = ResponseAssertions;
// ============================================
// Mock Factory
// ============================================
class MockFactory {
    definition;
    states = new Map();
    constructor(definition) {
        this.definition = definition;
    }
    /**
     * Define a state
     */
    state(name, attributes) {
        this.states.set(name, attributes);
        return this;
    }
    /**
     * Create a single instance
     */
    make(overrides = {}, states = []) {
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
    makeMany(count, overrides = {}, states = []) {
        return Array.from({ length: count }, () => this.make(overrides, states));
    }
    /**
     * Create with specific state
     */
    withState(name) {
        return {
            make: (overrides = {}) => this.make(overrides, [name]),
            makeMany: (count, overrides = {}) => this.makeMany(count, overrides, [name]),
        };
    }
}
exports.MockFactory = MockFactory;
// ============================================
// Test Helpers
// ============================================
/**
 * Create a test client
 */
function createTestClient(baseUrl) {
    return new TestClient(baseUrl);
}
/**
 * Create response assertions
 */
function assertResponse(response) {
    return new ResponseAssertions(response);
}
/**
 * Create a mock factory
 */
function factory(definition) {
    return new MockFactory(definition);
}
/**
 * Generate random string
 */
function randomString(length = 10) {
    return Math.random().toString(36).substring(2, 2 + length);
}
/**
 * Generate random email
 */
function randomEmail() {
    return `${randomString(8)}@test.example.com`;
}
/**
 * Generate random number
 */
function randomNumber(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
/**
 * Generate random UUID
 */
function randomUuid() {
    return crypto.randomUUID();
}
/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// ============================================
// Exports
// ============================================
exports.default = {
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
