/**
 * CanxJS Middleware - Async-first pipeline with error boundaries
 */
import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';
export declare class MiddlewarePipeline {
    private middlewares;
    use(...handlers: MiddlewareHandler[]): this;
    execute(req: CanxRequest, res: CanxResponse, routeMiddlewares: MiddlewareHandler[], finalHandler: () => Promise<Response> | Response): Promise<Response>;
}
export declare const cors: (options?: {
    origin?: string | string[];
    methods?: string[];
    credentials?: boolean;
}) => MiddlewareHandler;
export declare const logger: () => MiddlewareHandler;
export declare const bodyParser: () => MiddlewareHandler;
export declare const rateLimit: (options?: {
    windowMs?: number;
    max?: number;
}) => MiddlewareHandler;
export declare const compress: () => MiddlewareHandler;
/**
 * Serve static files from a directory
 * @param root - The root directory to serve files from (relative to cwd or absolute)
 * @param options - Configuration options
 */
export declare const serveStatic: (root?: string, options?: {
    index?: string;
    maxAge?: number;
    extensions?: string[];
}) => MiddlewareHandler;
export declare function createMiddlewarePipeline(): MiddlewarePipeline;
export default MiddlewarePipeline;
