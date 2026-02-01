/**
 * CanxJS Server - High-performance HTTP server wrapper for Bun
 */
import type { ServerConfig, CanxRequest, CanxResponse, RouteParams } from '../types';
/**
 * Create enhanced CanxRequest from raw Bun Request
 */
export declare function createCanxRequest(raw: Request, params?: RouteParams): CanxRequest;
/**
 * Create CanxResponse builder
 */
export declare function createCanxResponse(): CanxResponse;
/**
 * CanxJS Server Class
 */
export declare class Server {
    private server;
    private config;
    private requestHandler;
    constructor(config: ServerConfig, handler: (req: Request) => Promise<Response> | Response);
    /**
     * Handle a request directly (useful for testing)
     */
    handle(req: Request): Promise<Response>;
    /**
     * Start the server
     */
    listen(callback?: () => void): Promise<void>;
    /**
     * Stop the server gracefully
     */
    close(): Promise<void>;
    /**
     * Get server instance
     */
    get instance(): Bun.Server<unknown> | null;
}
export default Server;
