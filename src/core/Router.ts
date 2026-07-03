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
  // State for named routes
  private namedRoutes: Map<string, string> = new Map();
  private lastRoutePath: string | null = null;

  // ... (previous)

  private routeCache: Map<string, RouteMatch | null> = new Map();


  // New Method: Name the last route
  name(name: string): RouterInstance {
      if (this.lastRoutePath) {
          this.namedRoutes.set(name, this.lastRoutePath);
      }
      return this;
  }

  // New Method: Generate URL
  url(name: string, params: Record<string, any> = {}): string {
      let path = this.namedRoutes.get(name);
      if (!path) throw new Error(`Route "${name}" not found.`);
      
      for (const [key, value] of Object.entries(params)) {
          path = path.replace(`:${key}`, encodeURIComponent(String(value)));
          // Also handle optional params? For V1, simplicity.
      }
      return path;
  }

  constructor(options?: RouterOptions) {
    this.routerOptions = { caseSensitive: false, trailingSlash: 'ignore', cache: true, ...options };
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ALL'];
    methods.forEach(m => this.trees.set(m, createNode()));
  }

  // Normalize leading/trailing slash but PRESERVE original casing.
  private normalizeCase(path: string): string {
    let p = path;
    if (this.routerOptions.trailingSlash === 'remove' && p.endsWith('/') && p.length > 1) p = p.slice(0, -1);
    return p.startsWith('/') ? p : '/' + p;
  }

  private normalizePath(path: string): string {
    const p = this.normalizeCase(path);
    return this.routerOptions.caseSensitive ? p : p.toLowerCase();
  }

  private addRoute(method: HttpMethod, path: string, handler: RouteHandler, mws: MiddlewareHandler[] = []): void {
    // Normalize path but preserve original for param name extraction
    const originalPath = (this.prefix + path).startsWith('/') ? this.prefix + path : '/' + this.prefix + path;
    this.lastRoutePath = originalPath;
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
    const cased = this.normalizeCase(path);
    const p = this.routerOptions.caseSensitive ? cased : cased.toLowerCase();
    const key = `${method}:${p}`;
    if (this.routeCache.has(key)) return this.routeCache.get(key) || null;

    let result = this.matchTree(this.trees.get(method)!, p, cased) || this.matchTree(this.trees.get('ALL')!, p, cased);

    // HEAD falls back to the GET handler (per the HTTP spec) when no explicit
    // HEAD route is registered.
    if (!result && method === 'HEAD') {
      result = this.matchTree(this.trees.get('GET')!, p, cased) || this.matchTree(this.trees.get('ALL')!, p, cased);
    }

    this.routeCache.set(key, result);
    return result;
  }

  // `path` is the lowercased routing path (for key matching); `casedPath`
  // preserves the original casing so param VALUES are not corrupted.
  private matchTree(tree: RadixNode, path: string, casedPath: string): RouteMatch | null {
    const segments = path.split('/').filter(Boolean);
    const casedSegments = casedPath.split('/').filter(Boolean);
    return this.matchNode(tree, segments, casedSegments, 0, {});
  }

  // Recursive matcher WITH backtracking: try exact child first, and if that
  // sub-tree dead-ends, fall back to the param child, then the wildcard. This
  // prevents a longer static route (e.g. /users/admin/settings) from shadowing
  // a param route (/users/:id) on an intermediate path like /users/admin.
  private matchNode(
    node: RadixNode,
    segments: string[],
    casedSegments: string[],
    i: number,
    params: RouteParams,
  ): RouteMatch | null {
    if (i === segments.length) {
      return node.handler ? { handler: node.handler, middlewares: node.middlewares, params: { ...params } } : null;
    }

    const seg = segments[i];
    const casedSeg = casedSegments[i] ?? seg;

    // 1. Exact static match
    const exact = node.children.get(this.routerOptions.caseSensitive ? seg : seg.toLowerCase());
    if (exact) {
      const r = this.matchNode(exact, segments, casedSegments, i + 1, params);
      if (r) return r;
    }

    // 2. Param match (original casing preserved)
    const paramChild = node.children.get(':');
    if (paramChild && paramChild.paramName) {
      const r = this.matchNode(paramChild, segments, casedSegments, i + 1, { ...params, [paramChild.paramName]: casedSeg });
      if (r) return r;
    }

    // 3. Wildcard captures the rest of the path
    const wildChild = node.children.get('*');
    if (wildChild && wildChild.handler && wildChild.paramName) {
      return {
        handler: wildChild.handler,
        middlewares: wildChild.middlewares,
        params: { ...params, [wildChild.paramName]: casedSegments.slice(i).join('/') },
      };
    }

    return null;
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
        if (typeof instance[key] !== 'function') {
            console.error(`Controller method ${key} not found on ${instance.constructor.name}`);
            return res.status(500).json({ error: `Method ${key} not found` });
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
