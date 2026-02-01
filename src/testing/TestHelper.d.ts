/**
 * CanxJS Test Helpers
 * Utilities for testing CanxJS applications
 */
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
export declare class HttpTest {
    private app;
    private headers;
    constructor(app: any);
    /**
     * Set headers for request
     */
    withHeaders(headers: Record<string, string>): this;
    /**
     * Set bearer token
     */
    withToken(token: string): this;
    /**
     * Make a GET request
     */
    get(path: string): Promise<TestResponse>;
    /**
     * Make a POST request
     */
    post(path: string, body?: any): Promise<TestResponse>;
    /**
     * Make a PUT request
     */
    put(path: string, body?: any): Promise<TestResponse>;
    /**
     * Make a PATCH request
     */
    patch(path: string, body?: any): Promise<TestResponse>;
    /**
     * Make a DELETE request
     */
    delete(path: string, body?: any): Promise<TestResponse>;
    /**
     * Make a generic request
     */
    request(method: HttpMethod, path: string, body?: any): Promise<TestResponse>;
}
export declare class DatabaseTest {
    /**
     * Seed the database
     */
    static seed(seederName: string): Promise<void>;
    /**
     * Refresh database (migrate fresh)
     */
    static refreshDatabase(): Promise<void>;
    /**
     * Assert database has record
     */
    static assertHas(table: string, data: Record<string, any>): Promise<void>;
    /**
     * Assert database missing record
     */
    static assertMissing(table: string, data: Record<string, any>): Promise<void>;
}
/**
 * Create HTTP test helper
 */
export declare function createHttpTest(app: any): HttpTest;
/**
 * Basic Test Case Wrapper
 */
export declare class TestCase {
    static setup(): void;
    static teardown(): void;
}
