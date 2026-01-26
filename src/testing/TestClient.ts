import { Canx as Application } from '../Application';

export class TestClient {
  constructor(private app: Application) {}

  get(path: string, headers: Record<string, string> = {}) {
    return new TestRequest(this.app, 'GET', path, headers);
  }

  post(path: string, body?: any, headers: Record<string, string> = {}) {
    return new TestRequest(this.app, 'POST', path, headers, body);
  }

  put(path: string, body?: any, headers: Record<string, string> = {}) {
    return new TestRequest(this.app, 'PUT', path, headers, body);
  }

  delete(path: string, headers: Record<string, string> = {}) {
    return new TestRequest(this.app, 'DELETE', path, headers);
  }
}

class TestRequest {
  private _headers: Record<string, string>;

  constructor(
    private app: Application,
    private method: string,
    private path: string,
    headers: Record<string, string>,
    private body?: any
  ) {
    this._headers = { ...headers };
    if (body) {
      this._headers['Content-Type'] = 'application/json';
    }
  }

  set(key: string, value: string) {
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

  async expect(status: number) {
    const res = await this.send();
    if (res.status !== status) {
      throw new Error(`Expected status ${status}, but got ${res.status}. Body: ${await res.text()}`);
    }
    return res;
  }

  async assertStatus(status: number) {
    return this.expect(status);
  }
}

class TestResponse {
  constructor(private res: Response) {}

  get status() {
    return this.res.status;
  }

  async json() {
    return this.res.json();
  }

  async text() {
    return this.res.text();
  }

  async expectJson(expected: any) {
    const data = await this.json();
    const strData = JSON.stringify(data);
    const strExpected = JSON.stringify(expected);
    if (strData !== strExpected) {
      throw new Error(`Expected JSON ${strExpected}, but got ${strData}`);
    }
    return this;
  }

  async assertJson(expected: any) {
    return this.expectJson(expected);
  }
}
