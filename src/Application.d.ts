/**
 * CanxJS - Main Application Class
 */
import type { ServerConfig, MiddlewareHandler, CanxApplication, RouterInstance, Plugin } from './types';
import { Router } from './core/Router';
export declare class Canx implements CanxApplication {
    config: ServerConfig;
    router: Router;
    private server;
    private pipeline;
    private plugins;
    constructor(config?: ServerConfig);
    /**
     * Register global middleware
     */
    use(middleware: MiddlewareHandler): this;
    /**
     * Register routes
     */
    routes(callback: (router: RouterInstance) => void): this;
    /**
     * Register controller
     */
    controller(ControllerClass: new () => any): this;
    /**
     * Register plugin
     */
    plugin(plugin: Plugin): this;
    /**
     * Start the server
     */
    listen(port?: number | (() => void), callback?: () => void): Promise<void>;
    /**
     * Handle a raw request (internal or for testing)
     */
    handle(rawReq: Request): Promise<Response>;
    /**
     * Stop the server
     */
    close(): Promise<void>;
    /**
     * Get router for chaining
     */
    get(path: string, ...handlers: any[]): this;
    post(path: string, ...handlers: any[]): this;
    put(path: string, ...handlers: any[]): this;
    patch(path: string, ...handlers: any[]): this;
    delete(path: string, ...handlers: any[]): this;
    all(path: string, ...handlers: any[]): this;
    /**
     * Register a resource controller with RESTful routes
     */
    resource(path: string, controller: any, ...middlewares: MiddlewareHandler[]): this;
    /**
     * Group routes with a common prefix
     */
    group(prefix: string, callback: (router: RouterInstance) => void): this;
    /**
     * Register routes under a versioned API path
     * @param version - Version identifier (e.g., 'v1', 'v2')
     * @param callback - Route registration callback
     */
    version(version: string, callback: (router: RouterInstance) => void): this;
}
/**
 * Create a new CanxJS application instance
 */
export declare function createApp(config?: ServerConfig): Canx;
/**
 * Define configuration with type checking
 * Helper for creating typed configuration objects
 */
export declare function defineConfig<T extends Record<string, any>>(config: T): T;
export default Canx;
