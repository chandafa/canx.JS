/**
 * CanxJS HTTP/2 Support
 * HTTP/2 server with push, streams, and multiplexing
 */
import type { MiddlewareHandler } from '../types';
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
    respond(headers: Record<string, string | number>, options?: {
        endStream?: boolean;
    }): void;
    write(data: string | Buffer): void;
    end(data?: string | Buffer): void;
}
export declare class Http2Server {
    private options;
    private server;
    private handlers;
    constructor(options?: Http2ServerOptions);
    /**
     * Register a GET handler
     */
    get(path: string, handler: MiddlewareHandler): this;
    /**
     * Register a POST handler
     */
    post(path: string, handler: MiddlewareHandler): this;
    /**
     * Register a PUT handler
     */
    put(path: string, handler: MiddlewareHandler): this;
    /**
     * Register a PATCH handler
     */
    patch(path: string, handler: MiddlewareHandler): this;
    /**
     * Register a DELETE handler
     */
    delete(path: string, handler: MiddlewareHandler): this;
    /**
     * Start the HTTP/2 server
     */
    start(): Promise<void>;
    /**
     * Stop the server
     */
    stop(): Promise<void>;
    /**
     * Handle an incoming request
     */
    private handleRequest;
    /**
     * Match path pattern
     */
    private matchPath;
    /**
     * Create request object
     */
    private createRequest;
    /**
     * Create response object
     */
    private createResponse;
}
export declare function createHttp2Middleware(handler: MiddlewareHandler): (stream: any, headers: any) => void;
export declare function createHttp2Server(options?: Http2ServerOptions): Http2Server;
/**
 * Quick start HTTP/2 server with handlers
 */
export declare function startHttp2(options: Http2ServerOptions & {
    routes?: Record<string, MiddlewareHandler>;
}): Promise<Http2Server>;
export default Http2Server;
