/**
 * CanxJS Router - Ultra-fast Radix Tree based routing
 */

import type {
  HttpMethod,
  Route,
  RouteHandler,
  RouterOptions,
  MiddlewareHandler,
  RouteParams,
  RouterInstance,
} from '../types';
import { getControllerMeta } from '../mvc/Controller';
import { container } from '../container/Container';

interface RadixNode {
  path: string;
  handler: RouteHandler | null;
  middlewares: MiddlewareHandler[];
  children: Map<string, RadixNode>;
  paramName: string | null;
  isWildcard: boolean;
  isParam: boolean;
}

interface RouteMatch {
  handler: RouteHandler;
  middlewares: MiddlewareHandler[];
  params: RouteParams;
}

function createNode(path: string = ''): RadixNode {
  return {
    path,
    handler: null,
    middlewares: [],
    children: new Map(),
    paramName: null,
    isWildcard: false,
    isParam: false,
  };
}

/**
 * Resolve a controller tuple [ControllerClass, "methodName"] or regular handler function
 * to an actual RouteHandler function
 */
function resolveHandler(handlerOrTuple: RouteHandler | [any, string]): RouteHandler {
  // If it's already a function, return as-is
  if (typeof handlerOrTuple === 'function') {
    return handlerOrTuple;
  }
  
  // If it's an array [ControllerClass, "methodName"], create handler
  if (Array.isArray(handlerOrTuple) && handlerOrTuple.length === 2) {
    const [ControllerClass, methodName] = handlerOrTuple;
    const instance = new ControllerClass();
    
    return async (req: any, res: any) => {
      if (typeof instance.setContext === 'function') {
        instance.setContext(req, res);
      }
      return instance[methodName](req, res);
    };
  }
  
  // Fallback - shouldn't reach here but just in case
  throw new Error(`Invalid handler: expected function or [Controller, "method"] tuple`);
}

export class Router implements RouterInstance {
  private trees: Map<HttpMethod, RadixNode> = new Map();
  private routerOptions: RouterOptions;
  private globalMiddlewares: MiddlewareHandler[] = [];
  private currentMiddlewares: MiddlewareHandler[] = [];
  private prefix: string = '';
  private routeCache: Map<string, RouteMatch | null> = new Map();

  constructor(options: RouterOptions = {}) {
    this.routerOptions = { caseSensitive: false, trailingSlash: 'ignore', cache: true, ...options };
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ALL'];
    methods.forEach(m => this.trees.set(m, createNode()));
  }

  private normalizePath(path: string): string {
    let p = this.routerOptions.caseSensitive ? path : path.toLowerCase();
    if (this.routerOptions.trailingSlash === 'remove' && p.endsWith('/') && p.length > 1) p = p.slice(0, -1);
    return p.startsWith('/') ? p : '/' + p;
  }

  private addRoute(method: HttpMethod, path: string, handler: RouteHandler, mws: MiddlewareHandler[] = []): void {
    // Normalize path but preserve original for param name extraction
    const originalPath = (this.prefix + path).startsWith('/') ? this.prefix + path : '/' + this.prefix + path;
    const normalized = this.normalizePath(this.prefix + path);
    const segments = normalized.split('/').filter(Boolean);
    const originalSegments = originalPath.split('/').filter(Boolean);
    let node = this.trees.get(method)!;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const originalSeg = originalSegments[i] || seg;
      let key = seg, isParam = false, isWild = false, param: string | null = null;
      
      // Extract param name from ORIGINAL segment to preserve casing
      if (originalSeg.startsWith(':')) { 
        isParam = true; 
        param = originalSeg.slice(1); // Use original casing
        key = ':'; 
      } else if (originalSeg === '*' || originalSeg.startsWith('*')) { 
        isWild = true; 
        param = originalSeg.length > 1 ? originalSeg.slice(1) : 'wildcard'; 
        key = '*'; 
      }

      if (!node.children.has(key)) {
        const child = createNode(seg);
        child.isParam = isParam; child.isWildcard = isWild; child.paramName = param;
        node.children.set(key, child);
      }
      node = node.children.get(key)!;
    }
    node.handler = handler;
    node.middlewares = [...this.globalMiddlewares, ...this.currentMiddlewares, ...mws];
    this.routeCache.clear();
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    const p = this.normalizePath(path);
    const key = `${method}:${p}`;
    if (this.routeCache.has(key)) return this.routeCache.get(key) || null;

    let result = this.matchTree(this.trees.get(method)!, p) || this.matchTree(this.trees.get('ALL')!, p);
    this.routeCache.set(key, result);
    return result;
  }

  private matchTree(tree: RadixNode, path: string): RouteMatch | null {
    const segments = path.split('/').filter(Boolean);
    const params: RouteParams = {};
    let node = tree;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      // Try exact match first
      let child = node.children.get(this.routerOptions.caseSensitive ? seg : seg.toLowerCase());
      
      // If no exact match, try parameter match
      if (!child) { 
        child = node.children.get(':'); 
        if (child?.paramName) params[child.paramName] = seg; 
      }
      
      // If still no match, try wildcard
      if (!child) {
        child = node.children.get('*');
        if (child?.paramName) { 
          params[child.paramName] = segments.slice(i).join('/'); 
          if (child.handler) return { handler: child.handler, middlewares: child.middlewares, params }; 
        }
      }
      
      if (!child) return null;
      
      // If this is a param node, capture the parameter value
      if (child.isParam && child.paramName && !params[child.paramName]) {
        params[child.paramName] = seg;
      }
      
      node = child;
    }
    return node.handler ? { handler: node.handler, middlewares: node.middlewares, params } : null;
  }

  get(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance { this.addRoute('GET', path, resolveHandler(h.pop() as RouteHandler | [any, string]), h as MiddlewareHandler[]); return this; }
  post(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance { this.addRoute('POST', path, resolveHandler(h.pop() as RouteHandler | [any, string]), h as MiddlewareHandler[]); return this; }
  put(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance { this.addRoute('PUT', path, resolveHandler(h.pop() as RouteHandler | [any, string]), h as MiddlewareHandler[]); return this; }
  patch(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance { this.addRoute('PATCH', path, resolveHandler(h.pop() as RouteHandler | [any, string]), h as MiddlewareHandler[]); return this; }
  delete(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance { this.addRoute('DELETE', path, resolveHandler(h.pop() as RouteHandler | [any, string]), h as MiddlewareHandler[]); return this; }
  options(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance { this.addRoute('OPTIONS', path, resolveHandler(h.pop() as RouteHandler | [any, string]), h as MiddlewareHandler[]); return this; }
  head(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance { this.addRoute('HEAD', path, resolveHandler(h.pop() as RouteHandler | [any, string]), h as MiddlewareHandler[]); return this; }
  all(path: string, ...h: (MiddlewareHandler | RouteHandler | [any, string])[]): RouterInstance { this.addRoute('ALL', path, resolveHandler(h.pop() as RouteHandler | [any, string]), h as MiddlewareHandler[]); return this; }

  controller(path: string, controllerClass: any): RouterInstance {
    // ... existing implementation logic delegated to registerController if possible, 
    // or keep separate. For now, let's keep it and add registerController.
    // Actually, registerController is what we need for the decorator based registration (no path arg needed as it is in decorator).
    const meta = getControllerMeta(controllerClass.prototype);
    return this.registerController(controllerClass, path);
  }

  /**
   * Register a controller using its decorator metadata
   */
  registerController(controllerOrClass: any, basePath: string = ''): RouterInstance {
    let instance: any;
    let prototype: any;

    if (typeof controllerOrClass === 'function') {
        instance = container.get(controllerOrClass) || new controllerOrClass();
        prototype = controllerOrClass.prototype;
    } else {
        instance = controllerOrClass;
        prototype = Object.getPrototypeOf(instance);
    }

    const meta = getControllerMeta(prototype);
    if (!meta) return this; 

    // Controller prefix from @Controller('prefix')
    const classPrefix = meta.prefix || '';

    meta.routes.forEach((route, key) => {
      const routePath = route.path;
      // Normalization: basePath + classPrefix + routePath
      const fullPath = [basePath, classPrefix, routePath]
        .map(p => p.startsWith('/') ? p : '/' + p)
        .join('')
        .replace(/\/\//g, '/'); // cleanup double slashes

      const handler = async (req: any, res: any) => {
        if (typeof instance.setContext === 'function') {
          instance.setContext(req, res);
        }
        return instance[key](req, res);
      };

      this.addRoute(route.method, fullPath === '/' ? '/' : fullPath.replace(/\/$/, ''), handler, [...meta.middlewares, ...route.middlewares]);
    });
    
    return this;
  }


  group(prefix: string, cb: (r: RouterInstance) => void): RouterInstance {
    const prev = this.prefix, prevMw = [...this.currentMiddlewares];
    this.prefix = prev + prefix;
    cb(this);
    this.prefix = prev; this.currentMiddlewares = prevMw;
    return this;
  }

  middleware(...h: MiddlewareHandler[]): RouterInstance { this.currentMiddlewares.push(...h); return this; }
  use(...h: MiddlewareHandler[]): Router { this.globalMiddlewares.push(...h); return this; }

  /**
   * Register a resource controller with standard RESTful routes
   * Creates: GET /, GET /:id, POST /, PUT /:id, DELETE /:id
   */
  resource(path: string, controller: any, ...middlewares: MiddlewareHandler[]): RouterInstance {
    const instance = typeof controller === 'function' ? new controller() : controller;
    const basePath = path.startsWith('/') ? path : '/' + path;
    
    // Helper to create handler
    const createHandler = (method: string) => async (req: any, res: any) => {
      if (typeof instance.setContext === 'function') {
        instance.setContext(req, res);
      }
      if (typeof instance[method] === 'function') {
        return instance[method](req, res);
      }
      return res.status(404).json({ error: `Method ${method} not found` });
    };

    // Standard RESTful routes
    if (typeof instance.index === 'function') {
      this.addRoute('GET', basePath, createHandler('index'), middlewares);
    }
    if (typeof instance.show === 'function') {
      this.addRoute('GET', basePath + '/:id', createHandler('show'), middlewares);
    }
    if (typeof instance.store === 'function') {
      this.addRoute('POST', basePath, createHandler('store'), middlewares);
    }
    if (typeof instance.update === 'function') {
      this.addRoute('PUT', basePath + '/:id', createHandler('update'), middlewares);
    }
    if (typeof instance.destroy === 'function') {
      this.addRoute('DELETE', basePath + '/:id', createHandler('destroy'), middlewares);
    }
    // Optional: create, edit for form-based apps
    if (typeof instance.create === 'function') {
      this.addRoute('GET', basePath + '/create', createHandler('create'), middlewares);
    }
    if (typeof instance.edit === 'function') {
      this.addRoute('GET', basePath + '/:id/edit', createHandler('edit'), middlewares);
    }

    return this;
  }

  getRoutes(): Route[] {
    const routes: Route[] = [];
    this.trees.forEach((tree, method) => this.collect(tree, '', method, routes));
    return routes;
  }

  private collect(node: RadixNode, path: string, method: HttpMethod, routes: Route[]): void {
    const p = path + (node.path ? '/' + node.path : '');
    if (node.handler) routes.push({ method, path: p || '/', handler: node.handler, middlewares: node.middlewares });
    node.children.forEach(c => this.collect(c, p, method, routes));
  }
}

export function createRouter(options?: RouterOptions): Router { return new Router(options); }
export default Router;
