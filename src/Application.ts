/**
 * CanxJS - Main Application Class
 */

import type { ServerConfig, MiddlewareHandler, HttpMethod, CanxApplication, RouterInstance, Plugin } from './types';
import { Server, createCanxRequest, createCanxResponse } from './core/Server';
import { Router, createRouter } from './core/Router';
import { MiddlewarePipeline } from './core/Middleware';
import { getControllerMeta } from './mvc/Controller';

export class Canx implements CanxApplication {
  config: ServerConfig;
  router: Router;
  private server: Server | null = null;
  private pipeline: MiddlewarePipeline;
  private plugins: Plugin[] = [];

  constructor(config: ServerConfig = {}) {
    this.config = {
      port: 3000,
      hostname: '0.0.0.0',
      development: process.env.NODE_ENV !== 'production',
      ...config,
    };
    this.router = createRouter();
    this.pipeline = new MiddlewarePipeline();
  }

  /**
   * Register global middleware
   */
  use(middleware: MiddlewareHandler): this {
    this.pipeline.use(middleware);
    return this;
  }

  /**
   * Register routes
   */
  routes(callback: (router: RouterInstance) => void): this {
    callback(this.router);
    return this;
  }

  /**
   * Register controller
   */
  controller(ControllerClass: new () => any): this {
    const instance = new ControllerClass();
    const meta = getControllerMeta(instance);

    meta.routes.forEach((routeInfo, methodName) => {
      const path = meta.prefix + routeInfo.path;
      const handler = async (req: any, res: any) => {
        instance.setContext(req, res);
        return instance[methodName](req, res);
      };

      const method = routeInfo.method.toLowerCase() as keyof Router;
      if (typeof this.router[method] === 'function') {
        (this.router as any)[method](path, ...routeInfo.middlewares, handler);
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
  async listen(port?: number, callback?: () => void): Promise<void> {
    if (port) this.config.port = port;

    // Initialize plugins
    for (const plugin of this.plugins) {
      await plugin.install(this);
    }

    // Create request handler
    const handleRequest = async (rawReq: Request): Promise<Response> => {
      const req = createCanxRequest(rawReq);
      const res = createCanxResponse();

      // Match route
      const match = this.router.match(req.method, req.path);

      if (!match) {
        return res.status(404).json({ error: 'Not Found', path: req.path });
      }

      // Update params
      Object.assign(req.params, match.params);

      // Execute middleware pipeline and handler
      return this.pipeline.execute(req, res, match.middlewares, () => match.handler(req, res));
    };

    this.server = new Server(this.config, handleRequest);
    await this.server.listen(callback);
  }

  /**
   * Stop the server
   */
  async close(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
  }

  /**
   * Get router for chaining
   */
  get(path: string, ...handlers: any[]): this { this.router.get(path, ...handlers); return this; }
  post(path: string, ...handlers: any[]): this { this.router.post(path, ...handlers); return this; }
  put(path: string, ...handlers: any[]): this { this.router.put(path, ...handlers); return this; }
  patch(path: string, ...handlers: any[]): this { this.router.patch(path, ...handlers); return this; }
  delete(path: string, ...handlers: any[]): this { this.router.delete(path, ...handlers); return this; }
}

export function createApp(config?: ServerConfig): Canx {
  return new Canx(config);
}

export default Canx;
