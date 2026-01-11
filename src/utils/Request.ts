/**
 * CanxJS Request - Enhanced request utilities
 */

import type { HttpMethod, QueryParams } from '../types';

export class RequestParser {
  private raw: Request;
  private url: URL;
  private _cookies: Map<string, string> | null = null;
  private _body: unknown = undefined;
  private _bodyParsed = false;

  constructor(raw: Request) {
    this.raw = raw;
    this.url = new URL(raw.url);
  }

  get method(): HttpMethod {
    return this.raw.method.toUpperCase() as HttpMethod;
  }

  get path(): string {
    return this.url.pathname;
  }

  get headers(): Headers {
    return this.raw.headers;
  }

  get query(): QueryParams {
    const query: QueryParams = {};
    this.url.searchParams.forEach((value, key) => {
      const existing = query[key];
      if (existing !== undefined) {
        query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        query[key] = value;
      }
    });
    return query;
  }

  get cookies(): Map<string, string> {
    if (!this._cookies) {
      this._cookies = new Map();
      const header = this.raw.headers.get('cookie');
      if (header) {
        header.split(';').forEach(c => {
          const [name, ...rest] = c.split('=');
          if (name) this._cookies!.set(name.trim(), rest.join('=').trim());
        });
      }
    }
    return this._cookies;
  }

  header(name: string): string | null {
    return this.raw.headers.get(name);
  }

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  async body<T = unknown>(): Promise<T> {
    if (!this._bodyParsed) {
      const contentType = this.raw.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        this._body = await this.raw.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await this.raw.text();
        this._body = Object.fromEntries(new URLSearchParams(text));
      } else if (contentType.includes('multipart/form-data')) {
        this._body = await this.raw.formData();
      } else {
        this._body = await this.raw.text();
      }
      this._bodyParsed = true;
    }
    return this._body as T;
  }

  async json<T = unknown>(): Promise<T> {
    if (!this._bodyParsed) {
      this._body = await this.raw.json();
      this._bodyParsed = true;
    }
    return this._body as T;
  }

  async formData(): Promise<FormData> {
    return this.raw.formData();
  }

  async text(): Promise<string> {
    return this.raw.text();
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.raw.arrayBuffer();
  }

  async files(): Promise<Map<string, File>> {
    const files = new Map<string, File>();
    const formData = await this.raw.formData();
    formData.forEach((value, key) => {
      if (value instanceof File) files.set(key, value);
    });
    return files;
  }

  get ip(): string {
    return this.header('x-forwarded-for')?.split(',')[0]?.trim() || 
           this.header('x-real-ip') || 
           'unknown';
  }

  get userAgent(): string | null {
    return this.header('user-agent');
  }

  get isAjax(): boolean {
    return this.header('x-requested-with')?.toLowerCase() === 'xmlhttprequest';
  }

  get isSecure(): boolean {
    return this.url.protocol === 'https:';
  }

  get accepts(): string[] {
    return (this.header('accept') || '*/*').split(',').map(s => s.trim().split(';')[0]);
  }
}

export function parseRequest(raw: Request): RequestParser {
  return new RequestParser(raw);
}

export default RequestParser;
