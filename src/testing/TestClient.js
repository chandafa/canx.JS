"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestClient = void 0;
class TestClient {
    app;
    constructor(app) {
        this.app = app;
    }
    get(path, headers = {}) {
        return new TestRequest(this.app, 'GET', path, headers);
    }
    post(path, body, headers = {}) {
        return new TestRequest(this.app, 'POST', path, headers, body);
    }
    put(path, body, headers = {}) {
        return new TestRequest(this.app, 'PUT', path, headers, body);
    }
    delete(path, headers = {}) {
        return new TestRequest(this.app, 'DELETE', path, headers);
    }
}
exports.TestClient = TestClient;
class TestRequest {
    app;
    method;
    path;
    body;
    _headers;
    constructor(app, method, path, headers, body) {
        this.app = app;
        this.method = method;
        this.path = path;
        this.body = body;
        this._headers = { ...headers };
        if (body) {
            this._headers['Content-Type'] = 'application/json';
        }
    }
    set(key, value) {
        this._headers[key] = value;
        return this;
    }
    async send() {
        const req = new Request(`http://localhost${this.path}`, {
            method: this.method,
            headers: this._headers,
            body: this.body ? JSON.stringify(this.body) : undefined,
        });
        const res = await this.app.handle(req);
        return new TestResponse(res);
    }
    async expect(status) {
        const res = await this.send();
        if (res.status !== status) {
            throw new Error(`Expected status ${status}, but got ${res.status}. Body: ${await res.text()}`);
        }
        return res;
    }
    async assertStatus(status) {
        return this.expect(status);
    }
}
class TestResponse {
    res;
    constructor(res) {
        this.res = res;
    }
    get status() {
        return this.res.status;
    }
    async json() {
        return this.res.json();
    }
    async text() {
        return this.res.text();
    }
    async expectJson(expected) {
        const data = await this.json();
        const strData = JSON.stringify(data);
        const strExpected = JSON.stringify(expected);
        if (strData !== strExpected) {
            throw new Error(`Expected JSON ${strExpected}, but got ${strData}`);
        }
        return this;
    }
    async assertJson(expected) {
        return this.expectJson(expected);
    }
}
