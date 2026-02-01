/**
 * CanxJS Testing Utilities - Base test case and helpers
 */
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
export declare class TestClient {
    private baseUrl;
    private defaultHeaders;
    private cookies;
    constructor(baseUrl?: string);
    /**
     * Set default headers for all requests
     */
    withHeaders(headers: Record<string, string>): this;
    /**
     * Set authorization header
     */
    withToken(token: string, type?: string): this;
    /**
     * Set a cookie
     */
    withCookie(name: string, value: string): this;
    /**
     * Make a GET request
     */
    get(path: string, query?: Record<string, string>): Promise<TestResponse>;
    /**
     * Make a POST request
     */
    post(path: string, body?: unknown): Promise<TestResponse>;
    /**
     * Make a PUT request
     */
    put(path: string, body?: unknown): Promise<TestResponse>;
    /**
     * Make a PATCH request
     */
    patch(path: string, body?: unknown): Promise<TestResponse>;
    /**
     * Make a DELETE request
     */
    delete(path: string): Promise<TestResponse>;
    /**
     * Make a request
     */
    request(req: TestRequest): Promise<TestResponse>;
}
export declare class ResponseAssertions {
    private response;
    constructor(response: TestResponse);
    /**
     * Assert status code
     */
    assertStatus(expected: number): this;
    /**
     * Assert successful response (2xx)
     */
    assertSuccessful(): this;
    /**
     * Assert OK response (200)
     */
    assertOk(): this;
    /**
     * Assert created response (201)
     */
    assertCreated(): this;
    /**
     * Assert no content response (204)
     */
    assertNoContent(): this;
    /**
     * Assert not found response (404)
     */
    assertNotFound(): this;
    /**
     * Assert unauthorized response (401)
     */
    assertUnauthorized(): this;
    /**
     * Assert forbidden response (403)
     */
    assertForbidden(): this;
    /**
     * Assert unprocessable entity (422)
     */
    assertUnprocessable(): this;
    /**
     * Assert header exists
     */
    assertHeader(name: string, value?: string): this;
    /**
     * Assert JSON structure
     */
    assertJson(expected: Record<string, unknown>): Promise<this>;
    /**
     * Assert JSON has keys
     */
    assertJsonHasKeys(...keys: string[]): Promise<this>;
    /**
     * Assert JSON path value
     */
    assertJsonPath(path: string, expected: unknown): Promise<this>;
    /**
     * Assert body contains text
     */
    assertBodyContains(text: string): Promise<this>;
}
export declare class MockFactory<T extends Record<string, unknown>> {
    private definition;
    private states;
    constructor(definition: () => T);
    /**
     * Define a state
     */
    state(name: string, attributes: Partial<T>): this;
    /**
     * Create a single instance
     */
    make(overrides?: Partial<T>, states?: string[]): T;
    /**
     * Create multiple instances
     */
    makeMany(count: number, overrides?: Partial<T>, states?: string[]): T[];
    /**
     * Create with specific state
     */
    withState(name: string): {
        make: (overrides?: Partial<T>) => T;
        makeMany: (count: number, overrides?: Partial<T>) => T[];
    };
}
/**
 * Create a test client
 */
export declare function createTestClient(baseUrl?: string): TestClient;
/**
 * Create response assertions
 */
export declare function assertResponse(response: TestResponse): ResponseAssertions;
/**
 * Create a mock factory
 */
export declare function factory<T extends Record<string, unknown>>(definition: () => T): MockFactory<T>;
/**
 * Generate random string
 */
export declare function randomString(length?: number): string;
/**
 * Generate random email
 */
export declare function randomEmail(): string;
/**
 * Generate random number
 */
export declare function randomNumber(min?: number, max?: number): number;
/**
 * Generate random UUID
 */
export declare function randomUuid(): string;
/**
 * Sleep helper
 */
export declare function sleep(ms: number): Promise<void>;
declare const _default: {
    TestClient: typeof TestClient;
    ResponseAssertions: typeof ResponseAssertions;
    MockFactory: typeof MockFactory;
    createTestClient: typeof createTestClient;
    assertResponse: typeof assertResponse;
    factory: typeof factory;
    randomString: typeof randomString;
    randomEmail: typeof randomEmail;
    randomNumber: typeof randomNumber;
    randomUuid: typeof randomUuid;
    sleep: typeof sleep;
};
export default _default;
