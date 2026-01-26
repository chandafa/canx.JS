/**
 * CanxJS HTTP/2 Support
 * HTTP/2 server with push, streams, and multiplexing
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';

// ============================================
// Types & Interfaces
// ============================================

export interface Http2ServerOptions {
  /** Port to listen on */
  port?: number;
  /** Hostname to bind */
  host?: string;
  /** SSL certificate path */
  cert?: string;
  /** SSL key path */
  key?: string;
  /** SSL certificate content (alternative to path) */
  certContent?: string;
  /** SSL key content (alternative to path) */
  keyContent?: string;
  /** Allow HTTP/1.1 fallback */
  allowHTTP1?: boolean;
  /** Max concurrent streams */
  maxConcurrentStreams?: number;
  /** Enable server push */
  enablePush?: boolean;
  /** Session timeout (ms) */
  sessionTimeout?: number;
}

export interface PushOptions {
  path: string;
  headers?: Record<string, string>;
  content?: string | Buffer;
}

export interface Http2Stream {
  id: number;
  push(options: PushOptions): Promise<void>;
  respond(headers: Record<string, string | number>, options?: { endStream?: boolean }): void;
  write(data: string | Buffer): void;
  end(data?: string | Buffer): void;
}

// ============================================
// HTTP/2 Server
// ============================================

export class Http2Server {
  private options: Http2ServerOptions;
  private server: any = null;
  private handlers: Map<string, Map<string, MiddlewareHandler>> = new Map();

  constructor(options: Http2ServerOptions = {}) {
    this.options = {
      port: 443,
      host: 'localhost',
      allowHTTP1: true,
      maxConcurrentStreams: 100,
      enablePush: true,
      sessionTimeout: 30000,
      ...options,
    };

    // Initialize method maps
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      this.handlers.set(method, new Map());
    }
  }

  /**
   * Register a GET handler
   */
  get(path: string, handler: MiddlewareHandler): this {
    this.handlers.get('GET')!.set(path, handler);
    return this;
  }

  /**
   * Register a POST handler
   */
  post(path: string, handler: MiddlewareHandler): this {
    this.handlers.get('POST')!.set(path, handler);
    return this;
  }

  /**
   * Register a PUT handler
   */
  put(path: string, handler: MiddlewareHandler): this {
    this.handlers.get('PUT')!.set(path, handler);
    return this;
  }

  /**
   * Register a PATCH handler
   */
  patch(path: string, handler: MiddlewareHandler): this {
    this.handlers.get('PATCH')!.set(path, handler);
    return this;
  }

  /**
   * Register a DELETE handler
   */
  delete(path: string, handler: MiddlewareHandler): this {
    this.handlers.get('DELETE')!.set(path, handler);
    return this;
  }

  /**
   * Start the HTTP/2 server
   */
  async start(): Promise<void> {
    const http2 = await import('node:http2');
    const fs = await import('node:fs');

    let serverOptions: any = {
      allowHTTP1: this.options.allowHTTP1,
    };

    // Load SSL certificates
    if (this.options.certContent && this.options.keyContent) {
      serverOptions.cert = this.options.certContent;
      serverOptions.key = this.options.keyContent;
    } else if (this.options.cert && this.options.key) {
      serverOptions.cert = fs.readFileSync(this.options.cert);
      serverOptions.key = fs.readFileSync(this.options.key);
    } else {
      // Generate self-signed cert for development
      console.warn('No SSL certificate provided. Using insecure HTTP/2 (h2c) - not recommended for production.');
      this.server = http2.createServer();
    }

    if (!this.server) {
      this.server = http2.createSecureServer(serverOptions);
    }

    // Set session options
    this.server.on('session', (session: any) => {
      session.setTimeout(this.options.sessionTimeout);
      
      if (this.options.maxConcurrentStreams) {
        session.settings({ maxConcurrentStreams: this.options.maxConcurrentStreams });
      }
    });

    // Handle streams
    this.server.on('stream', async (stream: any, headers: any) => {
      const method = headers[':method'] as string;
      const path = headers[':path'] as string;

      try {
        await this.handleRequest(stream, headers, method, path);
      } catch (error: any) {
        console.error('HTTP/2 Error:', error);
        stream.respond({ ':status': 500 });
        stream.end(JSON.stringify({ error: error.message }));
      }
    });

    // Handle errors
    this.server.on('error', (error: Error) => {
      console.error('HTTP/2 Server Error:', error);
    });

    return new Promise((resolve) => {
      this.server.listen(this.options.port, this.options.host, () => {
        console.log(`🚀 HTTP/2 server running on https://${this.options.host}:${this.options.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('HTTP/2 server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Handle an incoming request
   */
  private async handleRequest(
    stream: any,
    headers: Record<string, string>,
    method: string,
    path: string
  ): Promise<void> {
    const methodHandlers = this.handlers.get(method.toUpperCase());
    if (!methodHandlers) {
      stream.respond({ ':status': 405 });
      stream.end('Method Not Allowed');
      return;
    }

    // Find matching handler
    let handler: MiddlewareHandler | undefined;
    let params: Record<string, string> = {};

    for (const [pattern, h] of methodHandlers) {
      const match = this.matchPath(pattern, path);
      if (match) {
        handler = h;
        params = match.params;
        break;
      }
    }

    if (!handler) {
      stream.respond({ ':status': 404 });
      stream.end('Not Found');
      return;
    }

    // Create request object
    const req = this.createRequest(stream, headers, method, path, params);
    
    // Create response object
    const res = this.createResponse(stream);

    // Execute handler
    await handler(req, res, () => Promise.resolve());
  }

  /**
   * Match path pattern
   */
  private matchPath(pattern: string, path: string): { params: Record<string, string> } | null {
    const patternParts = pattern.split('/');
    const pathParts = path.split('?')[0].split('/');

    if (patternParts.length !== pathParts.length && !pattern.endsWith('*')) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith(':')) {
        params[patternPart.slice(1)] = pathPart;
      } else if (patternPart === '*') {
        // Wildcard matches rest
        break;
      } else if (patternPart !== pathPart) {
        return null;
      }
    }

    return { params };
  }

  /**
   * Create request object
   */
  private createRequest(
    stream: any,
    headers: Record<string, string>,
    method: string,
    path: string,
    params: Record<string, string>
  ): CanxRequest {
    const url = new URL(path, `https://${headers[':authority']}`);
    
    return {
      raw: new Request(url.toString(), {
        method,
        headers: headers as any,
      }), // Stub raw request for compatibility
      method: method as any,
      path,
      url: path,
      params,
      query: Object.fromEntries(url.searchParams),
      headers: new Headers(headers as any),
      body: async <T = unknown>() => {
        // Default body reader
        return new Promise((resolve, reject) => {
          let data = '';
          stream.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          stream.on('end', () => {
             try { resolve(JSON.parse(data)); } catch { resolve(data as any); }
          });
          stream.on('error', reject);
        });
      },
      json: async <T = unknown>() => {
        return new Promise((resolve, reject) => {
          let data = '';
          stream.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          stream.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch {
              resolve({} as any);
            }
          });
          stream.on('error', reject);
        });
      },
      text: async () => {
        return new Promise((resolve, reject) => {
          let data = '';
          stream.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          stream.on('end', () => resolve(data));
          stream.on('error', reject);
        });
      },
      formData: async () => {
        // Basic placeholder - HTTP/2 form data parsing is complex without external lib
        return new FormData();
      },
      arrayBuffer: async () => {
         return new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks).buffer));
          stream.on('error', reject);
        });
      },
      files: async () => new Map(), // Placeholder
      header: (name: string) => headers[name.toLowerCase()] || null,
      cookie: (name: string) => {
        const cookieHeader = headers['cookie'];
        if (!cookieHeader) return undefined;
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [k, v] = cookie.trim().split('=');
          acc[k] = v;
          return acc;
        }, {} as Record<string, string>);
        return cookies[name];
      },
      context: new Map(),
      timestamp: Date.now(),
      id: crypto.randomUUID(),
      user: undefined,
      session: undefined as any,
    } as CanxRequest;
  }

  /**
   * Create response object
   */
  private createResponse(stream: any): CanxResponse {
    let statusCode = 200;
    const responseHeaders: Record<string, string> = {};
    let headersWritten = false;

    const writeHeaders = () => {
      if (!headersWritten) {
        stream.respond({
          ':status': statusCode,
          ...responseHeaders,
        });
        headersWritten = true;
      }
    };

    return {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      header: (key: string, value: string) => {
        responseHeaders[key.toLowerCase()] = value;
        return res;
      },
      json: (data: any) => {
        responseHeaders['content-type'] = 'application/json';
        writeHeaders();
        stream.end(JSON.stringify(data));
        return res;
      },
      html: (html: string) => {
        responseHeaders['content-type'] = 'text/html; charset=utf-8';
        writeHeaders();
        stream.end(html);
        return res;
      },
      text: (text: string) => {
        responseHeaders['content-type'] = 'text/plain; charset=utf-8';
        writeHeaders();
        stream.end(text);
        return res;
      },
      send: (data: string | Buffer) => {
        writeHeaders();
        stream.end(data);
        return res;
      },
      // HTTP/2 Server Push
      push: async (options: PushOptions) => {
        if (!stream.pushAllowed) {
          console.warn('Server push not allowed by client');
          return res;
        }

        return new Promise<any>((resolve, reject) => {
          stream.pushStream(
            { ':path': options.path, ...options.headers },
            (err: Error | null, pushStream: any) => {
              if (err) {
                reject(err);
                return;
              }

              pushStream.respond({ ':status': 200 });
              if (options.content) {
                pushStream.end(options.content);
              } else {
                pushStream.end();
              }
              resolve(res);
            }
          );
        });
      },
    } as unknown as CanxResponse;

    const res = arguments[0];
  }
}

// ============================================
// HTTP/2 Middleware Wrapper
// ============================================

export function createHttp2Middleware(handler: MiddlewareHandler): (stream: any, headers: any) => void {
  return async (stream: any, headers: any) => {
    // This allows using existing CanxJS handlers with HTTP/2
    // Implementation would wrap stream/headers into req/res
  };
}

// ============================================
// Factory Functions
// ============================================

export function createHttp2Server(options?: Http2ServerOptions): Http2Server {
  return new Http2Server(options);
}

/**
 * Quick start HTTP/2 server with handlers
 */
export async function startHttp2(
  options: Http2ServerOptions & { routes?: Record<string, MiddlewareHandler> }
): Promise<Http2Server> {
  const server = new Http2Server(options);
  
  if (options.routes) {
    for (const [path, handler] of Object.entries(options.routes)) {
      server.get(path, handler);
    }
  }
  
  await server.start();
  return server;
}

export default Http2Server;
