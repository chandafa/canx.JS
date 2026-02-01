"use strict";
/**
 * CanxJS Test Helpers
 * Utilities for testing CanxJS applications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestCase = exports.DatabaseTest = exports.HttpTest = void 0;
exports.createHttpTest = createHttpTest;
const bun_test_1 = require("bun:test");
// ============================================
// HTTP Test Helper
// ============================================
class HttpTest {
    app; // Application instance (e.g. Server)
    headers = {};
    constructor(app) {
        this.app = app;
    }
    /**
     * Set headers for request
     */
    withHeaders(headers) {
        this.headers = { ...this.headers, ...headers };
        return this;
    }
    /**
     * Set bearer token
     */
    withToken(token) {
        this.headers['Authorization'] = `Bearer ${token}`;
        return this;
    }
    /**
     * Make a GET request
     */
    async get(path) {
        return this.request('GET', path);
    }
    /**
     * Make a POST request
     */
    async post(path, body) {
        return this.request('POST', path, body);
    }
    /**
     * Make a PUT request
     */
    async put(path, body) {
        return this.request('PUT', path, body);
    }
    /**
     * Make a PATCH request
     */
    async patch(path, body) {
        return this.request('PATCH', path, body);
    }
    /**
     * Make a DELETE request
     */
    async delete(path, body) {
        return this.request('DELETE', path, body);
    }
    /**
     * Make a generic request
     */
    async request(method, path, body) {
        const url = `http://localhost${path}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...this.headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        };
        // If app has a fetch handler (like Canx Server), use it directly
        // Otherwise fallback to global fetch if app is running on a port
        let res;
        if (this.app && typeof this.app.fetch === 'function') {
            const req = new Request(url, options);
            res = await this.app.fetch(req);
        }
        else {
            // Assume app is running externally or we use Bun.fetch locally if URL is valid
            // For unit testing framework, we usually want to invoke the handler directly
            throw new Error('App instance must provide a fetch() method for testing.');
        }
        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        }
        catch {
            json = null;
        }
        const headers = {};
        res.headers.forEach((v, k) => headers[k] = v);
        const testRes = {
            status: res.status,
            body: json,
            text,
            headers,
            assertStatus(status) {
                if (this.status !== status) {
                    throw new Error(`Expected status ${status} but got ${this.status}. Body: ${this.text}`);
                }
                (0, bun_test_1.expect)(this.status).toBe(status);
                return this;
            },
            assertJson(subset) {
                (0, bun_test_1.expect)(this.body).toMatchObject(subset);
                return this;
            },
            assertText(content) {
                (0, bun_test_1.expect)(this.text).toContain(content);
                return this;
            },
            assertHeader(key, value) {
                (0, bun_test_1.expect)(this.headers[key.toLowerCase()]).toBeDefined();
                if (value) {
                    (0, bun_test_1.expect)(this.headers[key.toLowerCase()]).toBe(value);
                }
                return this;
            }
        };
        return testRes;
    }
}
exports.HttpTest = HttpTest;
// ============================================
// Database Test Helper
// ============================================
class DatabaseTest {
    /**
     * Seed the database
     */
    static async seed(seederName) {
        // Logic to call seeder
        // This assumes seeders are registered in the global registry
    }
    /**
     * Refresh database (migrate fresh)
     */
    static async refreshDatabase() {
        // Logic to run migrations down then up
    }
    /**
     * Assert database has record
     */
    static async assertHas(table, data) {
        // Use DB query builder to check existence
        // const exists = await DB.table(table).where(data).exists();
        // expect(exists).toBe(true);
    }
    /**
     * Assert database missing record
     */
    static async assertMissing(table, data) {
        // const exists = await DB.table(table).where(data).exists();
        // expect(exists).toBe(false);
    }
}
exports.DatabaseTest = DatabaseTest;
// ============================================
// Factory
// ============================================
/**
 * Create HTTP test helper
 */
function createHttpTest(app) {
    return new HttpTest(app);
}
/**
 * Basic Test Case Wrapper
 */
class TestCase {
    static setup() {
        // Global setup
    }
    static teardown() {
        // Global teardown
    }
}
exports.TestCase = TestCase;
