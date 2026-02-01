/**
 * CanxJS Router - Ultra-fast Radix Tree based routing
 */
import type { HttpMethod, Route, RouteHandler, RouterOptions, MiddlewareHandler, RouteParams, RouterInstance } from '../types';
interface RouteMatch {
    handler: RouteHandler;
    middlewares: MiddlewareHandler[];
    params: RouteParams;
}
export declare class Router implements RouterInstance {
    private trees;
    private routerOptions;
    private globalMiddlewares;
    private currentMiddlewares;
    private prefix;
    private namedRoutes;
    private lastRoutePath;
    private routeCache;
    name(name: string): RouterInstance;
    url(name: string, params?: Record<string, any>): string;
    constructor(options?: RouterOptions);
    private normalizePath;
    private addRoute;
    match(method: HttpMethod, path: string): RouteMatch | null;
    private matchTree;
    get(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance;
    post(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance;
    put(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance;
    patch(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance;
    delete(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance;
    options(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance;
    head(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance;
    all(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance;
    controller(path: string, controllerClass: any): RouterInstance;
    /**
     * Register a controller using its decorator metadata
     */
    registerController(controllerOrClass: any, basePath?: string): RouterInstance;
    group(prefix: string, cb: (r: RouterInstance) => void): RouterInstance;
    middleware(...h: MiddlewareHandler[]): RouterInstance;
    use(...h: MiddlewareHandler[]): Router;
    /**
     * Register a resource controller with standard RESTful routes
     * Creates: GET /, GET /:id, POST /, PUT /:id, DELETE /:id
     */
    resource(path: string, controller: any, ...middlewares: MiddlewareHandler[]): RouterInstance;
    getRoutes(): Route[];
    private collect;
}
export declare function createRouter(options?: RouterOptions): Router;
export default Router;
