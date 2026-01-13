/**
 * CanxJS Controller - Base class with decorators and dependency injection
 */

import type { CanxRequest, CanxResponse, HttpMethod, MiddlewareHandler, ControllerMeta } from '../types';

// Controller metadata storage
const controllerMeta = new WeakMap<object, ControllerMeta>();

export function getControllerMeta(target: object): ControllerMeta {
  if (!controllerMeta.has(target)) {
    controllerMeta.set(target, { prefix: '', middlewares: [], routes: new Map() });
  }
  return controllerMeta.get(target)!;
}

// Decorators
export function Controller(prefix: string = ''): ClassDecorator {
  return (target: any) => {
    const meta = getControllerMeta(target.prototype);
    meta.prefix = prefix.startsWith('/') ? prefix : '/' + prefix;
  };
}

export function Middleware(...middlewares: MiddlewareHandler[]): MethodDecorator & ClassDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey !== undefined) {
      const meta = getControllerMeta(target);
      const existing = meta.routes.get(String(propertyKey)) || { method: 'GET' as HttpMethod, path: '', middlewares: [] };
      existing.middlewares.push(...middlewares);
      meta.routes.set(String(propertyKey), existing);
    } else {
      const meta = getControllerMeta(target.prototype);
      meta.middlewares.push(...middlewares);
    }
  };
}

function createMethodDecorator(method: HttpMethod) {
  return (path: string = ''): MethodDecorator => {
    return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const meta = getControllerMeta(target);
      const existing = meta.routes.get(String(propertyKey)) || { method, path: '', middlewares: [] };
      existing.method = method;
      existing.path = path.startsWith('/') ? path : '/' + path;
      meta.routes.set(String(propertyKey), existing);
    };
  };
}

export const Get = createMethodDecorator('GET');
export const Post = createMethodDecorator('POST');
export const Put = createMethodDecorator('PUT');
export const Patch = createMethodDecorator('PATCH');
export const Delete = createMethodDecorator('DELETE');

// Base Controller class
export abstract class BaseController {
  protected request!: CanxRequest;
  protected response!: CanxResponse;

  setContext(req: CanxRequest, res: CanxResponse): void {
    this.request = req;
    this.response = res;
  }

  protected json<T>(data: T, status: number = 200): Response {
    return this.response.status(status).json(data);
  }

  protected html(content: string, status: number = 200): Response {
    return this.response.status(status).html(content);
  }

  protected redirect(url: string, status: 301 | 302 = 302): Response {
    return this.response.redirect(url, status);
  }

  protected param(key: string): string | undefined {
    return this.request.params[key];
  }

  protected query(key: string): string | string[] | undefined {
    return this.request.query[key];
  }

  protected async body<T = unknown>(): Promise<T> {
    return this.request.body<T>();
  }

  protected header(name: string): string | null {
    return this.request.header(name);
  }

  protected cookie(name: string): string | undefined {
    return this.request.cookie(name);
  }

  protected setCookie(name: string, value: string, options?: any): void {
    this.response.cookie(name, value, options);
  }
}

export default BaseController;
