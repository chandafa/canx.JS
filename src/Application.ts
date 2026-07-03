/**
 * CanxJS - Main Application Class
 */

import type { ServerConfig, MiddlewareHandler, HttpMethod, CanxApplication, RouterInstance, Plugin } from './types';
import { Server, createCanxRequest, createCanxResponse } from './core/Server';
import { Router, createRouter } from './core/Router';
import { MiddlewarePipeline } from './core/Middleware';
import { getControllerMeta } from './mvc/Controller';
import { container } from './container/Container';

export class Canx implements CanxApplication {
  config: ServerConfig;
  router: Router;
  private server: Server | null = null;
  private pipeline: MiddlewarePipeline;
  private postPipeline: MiddlewarePipeline;
  private plugins: Plugin[] = [];

  constructor(config: ServerConfig = {}) {
    this.config = {
      port: 3000,
      hostname: '0.0.0.0',
      development: process.env.NODE_ENV !== 'production',
      ...config,
    };
    this.router = createRouter();
    
    // Bind Router to Container for global helpers
    // Bind Router to Container for global helpers
    container.instance('Router', this.router);

    this.pipeline = new MiddlewarePipeline();
    this.postPipeline = new MiddlewarePipeline();
  }

  /**
   * Register global middleware
   */
  use(middleware: MiddlewareHandler): this {
    this.pipeline.use(middleware);
    return this;
  }

  /**
   * Register global post-middleware (runs after route middleware)
   */
  usePost(middleware: MiddlewareHandler): this {
    this.postPipeline.use(middleware);
    return this;
  }

  /**
   * Register routes
   */
  routes(callback: (router: Router) => void): this {
    callback(this.router);
    return this;
  }

  /**
   * Register controller
   */
  controller(ControllerClass: new () => any): this {
    const instance = new ControllerClass();
    // Decorators store metadata on the class PROTOTYPE (that's the `target` a
    // method decorator receives), not on an instance. Looking it up on an
    // instance is a WeakMap miss and silently registers zero routes.
    const meta = getControllerMeta(ControllerClass.prototype);

    meta.routes.forEach((routeInfo, methodName) => {
      const path = meta.prefix + routeInfo.path;
      const handler = async (req: any, res: any) => {
        // setContext only exists on BaseController subclasses; plain @Controller
        // classes are still supported (their method receives req, res directly).
        if (typeof instance.setContext === 'function') {
          instance.setContext(req, res);
        }
        return instance[methodName](req, res);
      };

      const method = routeInfo.method.toLowerCase() as keyof Router;
      if (typeof this.router[method] === 'function') {
        // Class-level @Middleware applies to every action.
        (this.router as any)[method](path, ...meta.middlewares, ...routeInfo.middlewares, handler);
      }
    });

    return this;
  }

  /**
   * Register plugin
   */
  plugin(plugin: Plugin): this {
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Start the server
   */
  async listen(
    port?: number | ServerConfig | (() => void),
    callback?: () => void,
  ): Promise<void> {
    if (typeof port === 'function') {
      callback = port;
      port = undefined;
    } else if (port && typeof port === 'object') {
      // Options-object form: app.listen({ port, hostname, development, ... })
      this.config = { ...this.config, ...port };
      port = undefined;
    }

    if (port && typeof port === 'number') {
      this.config.port = port;
    }

    // Initialize plugins
    for (const plugin of this.plugins) {
      await plugin.install(this);
    }
    
    // Start Scheduler
    const { scheduler } = await import('./features/Scheduler');
    scheduler.start();

    this.server = new Server(this.config, (req) => this.handle(req));
    await this.server.listen(callback);
  }

  /**
   * Handle a raw request (internal or for testing)
   */
  async handle(rawReq: Request): Promise<Response> {
    const req = createCanxRequest(rawReq);
    const res = createCanxResponse();

    // Sentinel returned by the final handler when no route matched. This lets
    // global middleware (e.g. serveStatic) run and short-circuit BEFORE we
    // decide the request is a 404 — global middleware must run for unmatched
    // paths, otherwise static assets could never be served.
    const NOT_HANDLED = Symbol.for('canxjs.request.notHandled');

    try {
      // Match route (may be null — global middleware still gets a chance)
      const match = this.router.match(req.method, req.path);
      if (match) {
        Object.assign(req.params, match.params);
      }

      // Middleware order: [global pre (this.pipeline)] -> [route] -> [global post] -> handler.
      // Global post-middleware runs after route middleware but before the terminal handler.
      const postMiddlewares = (this.postPipeline as any).middlewares || [];
      const routeMiddlewares = match ? [...match.middlewares, ...postMiddlewares] : [];

      const finalHandler = async (): Promise<any> => {
        if (!match) return NOT_HANDLED;
        return match.handler(req, res);
      };

      // this.pipeline holds the global pre-middleware registered via app.use().
      // The pipeline is typed to return Response, but handlers may return raw
      // values (string/object) or our NOT_HANDLED sentinel, so treat as any.
      const result: any = await this.pipeline.execute(req, res, routeMiddlewares, finalHandler);

      // Nothing produced a response for an unmatched route -> surface a 404
      // to the Server's ErrorHandler (which renders a proper 404 page).
      if (result === NOT_HANDLED) {
        const { NotFoundException } = await import('./core/exceptions/NotFoundException');
        throw new NotFoundException(`Route not found: ${req.method} ${req.path}`);
      }

      // If handler returns string (e.g., from View()), wrap in HTML Response
      if (typeof result === 'string') {
        return res.html(result);
      }

      // If result is already a Response, return it
      if (result instanceof Response) {
        return result;
      }

      // If result is an object/array, return as JSON
      if (result !== null && result !== undefined) {
        return res.json(result);
      }

      // Fallback: empty 204 response
      return res.empty();

    } catch (error: any) {
      // Delegate to ErrorHandler (via Server.ts or manual call here if needed)
      // Since Server.ts calls this method, allowing it to bubble up is usually fine.
      // However, if we want to ensure any internal pipelines are caught, we rethrow.
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async close(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
      
      // Stop Scheduler
      const { scheduler } = await import('./features/Scheduler');
      scheduler.stop();
    }
  }

  /**
   * Get the internal server instance
   */
  getServer(): Server | null {
    return this.server;
  }

  /**
   * Get router for chaining
   */
  get(path: string, ...handlers: any[]): this { this.router.get(path, ...handlers); return this; }
  post(path: string, ...handlers: any[]): this { this.router.post(path, ...handlers); return this; }
  put(path: string, ...handlers: any[]): this { this.router.put(path, ...handlers); return this; }
  patch(path: string, ...handlers: any[]): this { this.router.patch(path, ...handlers); return this; }
  delete(path: string, ...handlers: any[]): this { this.router.delete(path, ...handlers); return this; }
  all(path: string, ...handlers: any[]): this { this.router.all(path, ...handlers); return this; }

  /**
   * Register a resource controller with RESTful routes
   */
  resource(path: string, controller: any, ...middlewares: MiddlewareHandler[]): this {
    this.router.resource(path, controller, ...middlewares);
    return this;
  }

  /**
   * Group routes with a common prefix
   */
  group(prefix: string, callback: (router: Router) => void): this {
    this.router.group(prefix, callback as any);
    return this;
  }

  /**
   * Register routes under a versioned API path
   * @param version - Version identifier (e.g., 'v1', 'v2')
   * @param callback - Route registration callback
   */
  version(version: string, callback: (router: Router) => void): this {
    const prefix = version.startsWith('/') ? version : '/api/' + version;
    this.router.group(prefix, callback as any);
    return this;
  }
}

/**
 * Create a new CanxJS application instance
 */
export function createApp(config?: ServerConfig): Canx {
  return new Canx(config);
}

/**
 * Define configuration with type checking
 * Helper for creating typed configuration objects
 */
export function defineConfig<T extends Record<string, any>>(config: T): T {
  return config;
}

// Alias for consistency with NestJS-style naming
export { Canx as Application };

/**
 * Application Configuration for module-based bootstrap
 */
interface ApplicationConfig extends ServerConfig {
  rootModule?: any;
}

/**
 * Create a new CanxJS application instance with module support
 * This is a NestJS-style factory function
 */
export function createApplication(config?: ApplicationConfig): Canx {
  const app = new Canx(config);
  
  // If rootModule is provided, bootstrap it
  if (config?.rootModule) {
    const meta = Reflect.getMetadata('module:metadata', config.rootModule);
    if (meta) {
      // Register controllers from the module
      if (meta.controllers) {
        for (const ControllerClass of meta.controllers) {
          app.controller(ControllerClass);
        }
      }
      // Register providers to container
      if (meta.providers) {
        for (const provider of meta.providers) {
          if (typeof provider === 'function') {
            container.bind(provider, provider);
          }
        }
      }
    }
  }
  
  return app;
}

export default Canx;

