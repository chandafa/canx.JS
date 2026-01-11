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
    const normalized = this.normalizePath(this.prefix + path);
    const tree = this.trees.get(method)!;
    const segments = normalized.split('/').filter(Boolean);
    let node = tree;

    for (const seg of segments) {
      let key = seg, isParam = false, isWild = false, param: string | null = null;
      if (seg.startsWith(':')) { isParam = true; param = seg.slice(1); key = ':'; }
      else if (seg === '*' || seg.startsWith('*')) { isWild = true; param = seg.length > 1 ? seg.slice(1) : 'wildcard'; key = '*'; }

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
      let child = node.children.get(this.routerOptions.caseSensitive ? seg : seg.toLowerCase());
      if (!child) { child = node.children.get(':'); if (child?.paramName) params[child.paramName] = seg; }
      if (!child) {
        child = node.children.get('*');
        if (child?.paramName) { params[child.paramName] = segments.slice(i).join('/'); if (child.handler) return { handler: child.handler, middlewares: child.middlewares, params }; }
      }
      if (!child) return null;
      node = child;
    }
    return node.handler ? { handler: node.handler, middlewares: node.middlewares, params } : null;
  }

  get(path: string, ...h: (MiddlewareHandler | RouteHandler)[]): RouterInstance { this.addRoute('GET', path, h.pop() as RouteHandler, h as MiddlewareHandler[]); return this; }
  post(path: string, ...h: (MiddlewareHandler | RouteHandler)[]): RouterInstance { this.addRoute('POST', path, h.pop() as RouteHandler, h as MiddlewareHandler[]); return this; }
  put(path: string, ...h: (MiddlewareHandler | RouteHandler)[]): RouterInstance { this.addRoute('PUT', path, h.pop() as RouteHandler, h as MiddlewareHandler[]); return this; }
  patch(path: string, ...h: (MiddlewareHandler | RouteHandler)[]): RouterInstance { this.addRoute('PATCH', path, h.pop() as RouteHandler, h as MiddlewareHandler[]); return this; }
  delete(path: string, ...h: (MiddlewareHandler | RouteHandler)[]): RouterInstance { this.addRoute('DELETE', path, h.pop() as RouteHandler, h as MiddlewareHandler[]); return this; }
  options(path: string, ...h: (MiddlewareHandler | RouteHandler)[]): RouterInstance { this.addRoute('OPTIONS', path, h.pop() as RouteHandler, h as MiddlewareHandler[]); return this; }
  head(path: string, ...h: (MiddlewareHandler | RouteHandler)[]): RouterInstance { this.addRoute('HEAD', path, h.pop() as RouteHandler, h as MiddlewareHandler[]); return this; }
  all(path: string, ...h: (MiddlewareHandler | RouteHandler)[]): RouterInstance { this.addRoute('ALL', path, h.pop() as RouteHandler, h as MiddlewareHandler[]); return this; }

  group(prefix: string, cb: (r: RouterInstance) => void): RouterInstance {
    const prev = this.prefix, prevMw = [...this.currentMiddlewares];
    this.prefix = prev + prefix;
    cb(this);
    this.prefix = prev; this.currentMiddlewares = prevMw;
    return this;
  }

  middleware(...h: MiddlewareHandler[]): RouterInstance { this.currentMiddlewares.push(...h); return this; }
  use(...h: MiddlewareHandler[]): Router { this.globalMiddlewares.push(...h); return this; }

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
