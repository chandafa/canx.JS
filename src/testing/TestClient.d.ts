import { Canx as Application } from '../Application';
export declare class TestClient {
    private app;
    constructor(app: Application);
    get(path: string, headers?: Record<string, string>): TestRequest;
    post(path: string, body?: any, headers?: Record<string, string>): TestRequest;
    put(path: string, body?: any, headers?: Record<string, string>): TestRequest;
    delete(path: string, headers?: Record<string, string>): TestRequest;
}
declare class TestRequest {
    private app;
    private method;
    private path;
    private body?;
    private _headers;
    constructor(app: Application, method: string, path: string, headers: Record<string, string>, body?: any | undefined);
    set(key: string, value: string): this;
    send(): Promise<TestResponse>;
    expect(status: number): Promise<TestResponse>;
    assertStatus(status: number): Promise<TestResponse>;
}
declare class TestResponse {
    private res;
    constructor(res: Response);
    get status(): number;
    json(): Promise<any>;
    text(): Promise<string>;
    expectJson(expected: any): Promise<this>;
    assertJson(expected: any): Promise<this>;
}
export {};
