/**
 * CanxJS Server - High-performance HTTP server wrapper for Bun
 */

import type {
  ServerConfig,
  CanxRequest,
  CanxResponse,
  HttpMethod,
  RouteParams,
  QueryParams,
  CookieOptions,
  CorsConfig,
} from '../types';
import { ErrorHandler } from './ErrorHandler';
import pc from 'picocolors';

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `canx_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parse cookies from header
 */
function parseCookies(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    if (name) {
      cookies.set(name.trim(), rest.join('=').trim());
    }
  });
  
  return cookies;
}

/**
 * Parse query string
 */
function parseQuery(url: URL): QueryParams {
  const query: QueryParams = {};
  url.searchParams.forEach((value, key) => {
    const existing = query[key];
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        query[key] = [existing, value];
      }
    } else {
      query[key] = value;
    }
  });
  return query;
}

/**
 * Create enhanced CanxRequest from raw Bun Request
 */
export function createCanxRequest(
  raw: Request,
  params: RouteParams = {}
): CanxRequest {
  const url = new URL(raw.url);
  const cookies = parseCookies(raw.headers.get('cookie'));
  
  let bodyParsed = false;
  let cachedBody: unknown;

  const request: CanxRequest = {
    raw,
    method: raw.method.toUpperCase() as HttpMethod,
    path: url.pathname,
    params,
    query: parseQuery(url),
    headers: raw.headers,
    context: new Map(),
    timestamp: Date.now(),
    id: generateRequestId(),
    session: undefined as any,

    async body<T = unknown>(): Promise<T> {
      if (bodyParsed) return cachedBody as T;
      
      const contentType = raw.headers.get('content-type') || '';
      
      try {
          if (contentType.includes('application/json')) {
            cachedBody = await raw.json();
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const text = await raw.text();
            cachedBody = Object.fromEntries(new URLSearchParams(text));
          } else if (contentType.includes('multipart/form-data')) {
            // FormData is special, it doesn't map nicely to a simple object for simple caching without loss
            // But let's cache it as FormData object?
            // Usually body() implies "data payload". 
            // Let's stick to raw.formData() but mark parsed.
            // cachedBody = await raw.formData();
            // Actually, let's allow formData to be separate or handle it here?
            cachedBody = await raw.formData();
          } else {
            cachedBody = await raw.text();
          }
          bodyParsed = true;
          return cachedBody as T;
      } catch (e) {
          throw new Error(`Failed to parse body: ${(e as Error).message}`);
      }
    },

    async json<T = unknown>(): Promise<T> {
      if (bodyParsed) return cachedBody as T;
      cachedBody = await raw.json();
      bodyParsed = true;
      return cachedBody as T;
    },

    async formData(): Promise<FormData> {
      if (bodyParsed && cachedBody instanceof FormData) return cachedBody;
      return raw.formData();
    },

    async text(): Promise<string> {
      if (bodyParsed) {
          if (typeof cachedBody === 'string') return cachedBody;
          if (typeof cachedBody === 'object') return JSON.stringify(cachedBody);
          return String(cachedBody);
      }
      const text = await raw.text();
      cachedBody = text;
      bodyParsed = true;
      return text;
    },

    async arrayBuffer(): Promise<ArrayBuffer> {
      return raw.arrayBuffer();
    },

    async files(): Promise<Map<string, File>> {
      const files = new Map<string, File>();
      const formData = await raw.formData();
      
      formData.forEach((value, key) => {
        if (value instanceof File) {
          files.set(key, value);
        }
      });
      
      return files;
    },

    header(name: string): string | null {
      return raw.headers.get(name);
    },

    cookie(name: string): string | undefined {
      return cookies.get(name);
    },
  };

  return request;
}

/**
 * Create CanxResponse builder
 */
export function createCanxResponse(): CanxResponse {
  let statusCode = 200;
  const responseHeaders = new Headers();
  const responseCookies: string[] = [];
  let headersSentFlag = false;

  const response: CanxResponse = {
    headersSent: false,

    status(code: number): CanxResponse {
      statusCode = code;
      return response;
    },

    header(name: string, value: string): CanxResponse {
      responseHeaders.set(name, value);
      return response;
    },

    headers(headers: Record<string, string>): CanxResponse {
      Object.entries(headers).forEach(([name, value]) => {
        responseHeaders.set(name, value);
      });
      return response;
    },

    json<T = unknown>(data: T): Response {
      responseHeaders.set('Content-Type', 'application/json');
      addCookiesToHeaders();
      return new Response(JSON.stringify(data), {
        status: statusCode,
        headers: responseHeaders,
      });
    },

    html(content: string): Response {
      responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
      addCookiesToHeaders();
      return new Response(content, {
        status: statusCode,
        headers: responseHeaders,
      });
    },

    text(content: string): Response {
      responseHeaders.set('Content-Type', 'text/plain; charset=utf-8');
      addCookiesToHeaders();
      return new Response(content, {
        status: statusCode,
        headers: responseHeaders,
      });
    },

    async file(path: string): Promise<Response> {
      const file = Bun.file(path);
      const exists = await file.exists();
      
      if (!exists) {
        return new Response('File not found', { status: 404 });
      }
      
      responseHeaders.set('Content-Type', file.type);
      responseHeaders.set('Content-Length', String(file.size));
      addCookiesToHeaders();
      
      return new Response(file, {
        status: statusCode,
        headers: responseHeaders,
      });
    },

    async download(path: string, filename?: string): Promise<Response> {
      const file = Bun.file(path);
      const exists = await file.exists();
      
      if (!exists) {
        return new Response('File not found', { status: 404 });
      }
      
      const downloadName = filename || path.split('/').pop() || 'download';
      responseHeaders.set('Content-Type', 'application/octet-stream');
      responseHeaders.set('Content-Disposition', `attachment; filename="${downloadName}"`);
      responseHeaders.set('Content-Length', String(file.size));
      addCookiesToHeaders();
      
      return new Response(file, {
        status: statusCode,
        headers: responseHeaders,
      });
    },

    stream(readable: ReadableStream): Response {
      responseHeaders.set('Content-Type', 'application/octet-stream');
      responseHeaders.set('Transfer-Encoding', 'chunked');
      addCookiesToHeaders();
      
      return new Response(readable, {
        status: statusCode,
        headers: responseHeaders,
      });
    },

    redirect(url: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response {
      responseHeaders.set('Location', url);
      addCookiesToHeaders();
      return new Response(null, {
        status,
        headers: responseHeaders,
      });
    },

    cookie(name: string, value: string, options: CookieOptions = {}): CanxResponse {
      let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
      
      if (options.maxAge !== undefined) {
        cookieStr += `; Max-Age=${options.maxAge}`;
      }
      if (options.expires) {
        cookieStr += `; Expires=${options.expires.toUTCString()}`;
      }
      if (options.path) {
        cookieStr += `; Path=${options.path}`;
      }
      if (options.domain) {
        cookieStr += `; Domain=${options.domain}`;
      }
      if (options.secure) {
        cookieStr += '; Secure';
      }
      if (options.httpOnly) {
        cookieStr += '; HttpOnly';
      }
      if (options.sameSite) {
        cookieStr += `; SameSite=${options.sameSite}`;
      }
      
      responseCookies.push(cookieStr);
      return response;
    },

    clearCookie(name: string): CanxResponse {
      return response.cookie(name, '', { maxAge: 0 });
    },

    render(component: JSX.Element): Response {
      // Will be implemented with View engine
      responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
      addCookiesToHeaders();
      
      // Convert JSX to string (Bun's renderToString)
      const html = String(component);
      
      return new Response(html, {
        status: statusCode,
        headers: responseHeaders,
      });
    },

    empty(status = 204): Response {
      addCookiesToHeaders();
      return new Response(null, {
        status,
        headers: responseHeaders,
      });
    },

    sse(generator: AsyncGenerator<string>): Response {
      responseHeaders.set('Content-Type', 'text/event-stream');
      responseHeaders.set('Cache-Control', 'no-cache');
      responseHeaders.set('Connection', 'keep-alive');
      addCookiesToHeaders();

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const data of generator) {
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        status: statusCode,
        headers: responseHeaders,
      });
    },

    hotwire(content: string, options: { target: string; action?: 'replace' | 'update' | 'prepend' | 'append' | 'remove' | 'after' | 'before' } = { target: 'body' }): Response {
      responseHeaders.set('Content-Type', 'text/vnd.turbo-stream.html; charset=utf-8');
      addCookiesToHeaders();

      const action = options.action || 'replace';
      const target = options.target;

      // Clean up content if it's not a string (e.g. if extended to support array/objects)
      const htmlContent = String(content);

      const streamHtml = `
<turbo-stream action="${action}" target="${target}">
  <template>
    ${htmlContent}
  </template>
</turbo-stream>`.trim();

      return new Response(streamHtml, {
        status: statusCode,
        headers: responseHeaders,
      });
    },
  };

  function addCookiesToHeaders() {
    responseCookies.forEach(cookie => {
      responseHeaders.append('Set-Cookie', cookie);
    });
  }

  return response;
}

/**
 * Default CORS headers
 */
function getCorsHeaders(config: CorsConfig, origin: string): Headers {
  const headers = new Headers();
  
  // Origin
  if (config.origin === true) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (typeof config.origin === 'string') {
    headers.set('Access-Control-Allow-Origin', config.origin);
  } else if (Array.isArray(config.origin)) {
    if (config.origin.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    }
  } else if (typeof config.origin === 'function') {
    if (config.origin(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    }
  }
  
  // Methods
  if (config.methods) {
    headers.set('Access-Control-Allow-Methods', config.methods.join(', '));
  }
  
  // Headers
  if (config.allowedHeaders) {
    headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
  }
  
  if (config.exposedHeaders) {
    headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
  }
  
  // Credentials
  if (config.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  // Max Age
  if (config.maxAge) {
    headers.set('Access-Control-Max-Age', String(config.maxAge));
  }
  
  return headers;
}

/**
 * CanxJS Server Class
 */
export class Server {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private config: ServerConfig;
  private requestHandler: (req: Request) => Promise<Response> | Response;

  constructor(
    config: ServerConfig,
    handler: (req: Request) => Promise<Response> | Response
  ) {
    this.config = {
      port: 3000,
      hostname: '0.0.0.0',
      development: process.env.NODE_ENV !== 'production',
      maxBodySize: 10 * 1024 * 1024, // 10MB
      timeout: 30000,
      compression: true,
      ...config,
    };
    this.requestHandler = handler;
  }

  /**
   * Handle a request directly (useful for testing)
   */
  async handle(req: Request): Promise<Response> {
    return this.requestHandler(req);
  }

  /**
   * Start the server
   */
  async listen(callback?: () => void): Promise<void> {
    const corsConfig: CorsConfig | null = this.config.cors === true
      ? { origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }
      : this.config.cors || null;

    try {
      this.server = Bun.serve({
        port: this.config.port,
        hostname: this.config.hostname,
        development: this.config.development,
        
        tls: this.config.tls ? {
          cert: Bun.file(this.config.tls.cert),
          key: Bun.file(this.config.tls.key),
          ca: this.config.tls.ca ? Bun.file(this.config.tls.ca) : undefined,
          passphrase: this.config.tls.passphrase,
        } : undefined,

        fetch: async (req: Request) => {
          const startTime = performance.now();
          
          try {
            // Handle CORS preflight
            if (corsConfig && req.method === 'OPTIONS') {
              const origin = req.headers.get('origin') || '';
              const headers = getCorsHeaders(corsConfig, origin);
              return new Response(null, { status: 204, headers });
            }

            // Handle static files
            if (this.config.static) {
              const url = new URL(req.url);
              if (url.pathname.startsWith('/static/')) {
                const filePath = `${this.config.static}${url.pathname.replace('/static', '')}`;
                const file = Bun.file(filePath);
                if (await file.exists()) {
                  return new Response(file);
                }
              }
            }

            // Main request handling
            let response = await this.requestHandler(req);

            // Add CORS headers
            if (corsConfig) {
              const origin = req.headers.get('origin') || '';
              const corsHeaders = getCorsHeaders(corsConfig, origin);
              corsHeaders.forEach((value, key) => {
                response.headers.set(key, value);
              });
            }

            // Add timing header in development
            if (this.config.development) {
              const duration = (performance.now() - startTime).toFixed(2);
              response.headers.set('X-Response-Time', `${duration}ms`);
            }

            return response;

          } catch (error: any) {
            return ErrorHandler.handle(error, req, this.config.development);
          }
        },

        error(error: Error) {
          // Can't access req object easily here in Bun's error handler, 
          // but it catches low-level server errors
          console.error('[CanxJS Server Error]', error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        },
      });

      if (callback) {
        callback();
      }

      const displayHost = this.config.hostname === '0.0.0.0' ? 'localhost' : this.config.hostname;
      const environment = this.config.development ? pc.yellow('development') : pc.green('production');
      const url = `http://${displayHost}:${this.config.port}`;
      
      console.log(`
${pc.cyan('╔══════════════════════════════════════════════════════════╗')}
${pc.cyan('║')}                                                          ${pc.cyan('║')}
${pc.cyan('║')}   🚀 ${pc.bold(pc.magenta('CanxJS Server'))} running                               ${pc.cyan('║')}
${pc.cyan('║')}                                                          ${pc.cyan('║')}
${pc.cyan('║')}   → Local:   ${pc.bold(pc.underline(url))}                        ${pc.cyan('║')}
${pc.cyan('║')}   → Mode:    ${environment}                              ${pc.cyan('║')}
${pc.cyan('║')}                                                          ${pc.cyan('║')}
${pc.cyan('╚══════════════════════════════════════════════════════════╝')}
      `);
    } catch (error: any) {
      if (error.code === 'EADDRINUSE' || error.message?.includes('EADDRINUSE') || error.syscall === 'listen') {
        console.error(`
${pc.red('╔══════════════════════════════════════════════════════════╗')}
${pc.red('║')}                                                          ${pc.red('║')}
${pc.red('║')}   ❌ ${pc.bold('ERROR: Port ' + this.config.port + ' is already in use')}                  ${pc.red('║')}
${pc.red('║')}                                                          ${pc.red('║')}
${pc.red('║')}   It looks like another application is already using     ${pc.red('║')}
${pc.red('║')}   this port. Please try:                                 ${pc.red('║')}
${pc.red('║')}                                                          ${pc.red('║')}
${pc.red('║')}   1. Stopping the other process                          ${pc.red('║')}
${pc.red('║')}   2. Using a different port in your app config           ${pc.red('║')}
${pc.red('║')}      (e.g., app.create({ port: ${Number(this.config.port) + 1} }))              ${pc.red('║')}
${pc.red('║')}                                                          ${pc.red('║')}
${pc.red('╚══════════════════════════════════════════════════════════╝')}
        `);
        process.exit(1);
      } else {
        throw error;
      }
    }
  }

  /**
   * Stop the server gracefully
   */
  async close(): Promise<void> {
    if (this.server) {
      this.server.stop();
      this.server = null;
      console.log('[CanxJS] Server stopped gracefully');
    }
  }

  /**
   * Get server instance
   */
  get instance() {
    return this.server;
  }
}

export default Server;
