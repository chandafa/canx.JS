/**
 * CanxJS Response - Enhanced response utilities
 */

import type { CookieOptions } from '../types';

export class ResponseBuilder {
  private statusCode: number = 200;
  private headers: Headers = new Headers();
  private cookies: string[] = [];

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  header(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }

  cookie(name: string, value: string, options: CookieOptions = {}): this {
    let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    if (options.maxAge) cookieStr += `; Max-Age=${options.maxAge}`;
    if (options.expires) cookieStr += `; Expires=${options.expires.toUTCString()}`;
    if (options.path) cookieStr += `; Path=${options.path}`;
    if (options.domain) cookieStr += `; Domain=${options.domain}`;
    if (options.secure) cookieStr += '; Secure';
    if (options.httpOnly) cookieStr += '; HttpOnly';
    if (options.sameSite) cookieStr += `; SameSite=${options.sameSite}`;
    this.cookies.push(cookieStr);
    return this;
  }

  private finalize(): Headers {
    this.cookies.forEach(c => this.headers.append('Set-Cookie', c));
    return this.headers;
  }

  json<T>(data: T): Response {
    this.headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(data), { status: this.statusCode, headers: this.finalize() });
  }

  html(content: string): Response {
    this.headers.set('Content-Type', 'text/html; charset=utf-8');
    return new Response(content, { status: this.statusCode, headers: this.finalize() });
  }

  text(content: string): Response {
    this.headers.set('Content-Type', 'text/plain; charset=utf-8');
    return new Response(content, { status: this.statusCode, headers: this.finalize() });
  }

  redirect(url: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response {
    this.headers.set('Location', url);
    return new Response(null, { status, headers: this.finalize() });
  }

  async file(path: string): Promise<Response> {
    const file = Bun.file(path);
    if (!(await file.exists())) return new Response('Not Found', { status: 404 });
    this.headers.set('Content-Type', file.type);
    this.headers.set('Content-Length', String(file.size));
    return new Response(file, { status: this.statusCode, headers: this.finalize() });
  }

  async download(path: string, filename?: string): Promise<Response> {
    const file = Bun.file(path);
    if (!(await file.exists())) return new Response('Not Found', { status: 404 });
    const name = filename || path.split('/').pop() || 'download';
    this.headers.set('Content-Type', 'application/octet-stream');
    this.headers.set('Content-Disposition', `attachment; filename="${name}"`);
    return new Response(file, { status: this.statusCode, headers: this.finalize() });
  }

  stream(readable: ReadableStream): Response {
    this.headers.set('Transfer-Encoding', 'chunked');
    return new Response(readable, { status: this.statusCode, headers: this.finalize() });
  }

  sse(generator: AsyncGenerator<string>): Response {
    this.headers.set('Content-Type', 'text/event-stream');
    this.headers.set('Cache-Control', 'no-cache');
    this.headers.set('Connection', 'keep-alive');
    
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const data of generator) {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.close();
        } catch (e) { controller.error(e); }
      },
    });
    return new Response(stream, { status: this.statusCode, headers: this.finalize() });
  }

  empty(status = 204): Response {
    return new Response(null, { status, headers: this.finalize() });
  }
}

export function response(): ResponseBuilder {
  return new ResponseBuilder();
}

export default ResponseBuilder;
