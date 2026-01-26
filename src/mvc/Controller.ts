/**
 * CanxJS Controller - Base class with decorators and dependency injection
 */

import type { CanxRequest, CanxResponse, HttpMethod, MiddlewareHandler, ControllerMeta } from '../types';
import { getParamMetadata, resolveParams } from '../core/Decorators';
import { view as renderView } from './View';

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
export const Options = createMethodDecorator('OPTIONS');
export const Head = createMethodDecorator('HEAD');

/**
 * Wrap a controller method to automatically resolve parameter decorators
 * This is called by the Router when registering controller routes
 */
export function wrapWithParamResolution(
  controller: any,
  methodName: string,
  originalMethod: Function
): (req: CanxRequest, res: CanxResponse) => Promise<Response> {
  return async (req: CanxRequest, res: CanxResponse) => {
    // Check if method uses parameter decorators
    const paramMetadata = getParamMetadata(controller, methodName);
    
    if (paramMetadata.length > 0) {
      // Resolve all parameters using decorators
      const args = await resolveParams(controller, methodName, req, res);
      return originalMethod.apply(controller, args);
    } else {
      // Fall back to traditional (req, res) pattern
      return originalMethod.call(controller, req, res);
    }
  };
}

/**
 * Validate decorator - validates request body against a schema
 * @param schema - Zod-like schema with parse/safeParse method
 */
export function Validate(schema: { parse?: (data: any) => any; safeParse?: (data: any) => { success: boolean; data?: any; error?: any } }): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(this: BaseController, req: CanxRequest, res: CanxResponse) {
      try {
        const body = await req.body();
        
        // Support both parse and safeParse
        if (schema.safeParse) {
          const result = schema.safeParse(body);
          if (!result.success) {
            return res.status(422).json({
              error: 'Validation failed',
              details: result.error?.issues || result.error,
            });
          }
          // Attach validated data to request
          (req as any).validated = result.data;
        } else if (schema.parse) {
          try {
            const validated = schema.parse(body);
            (req as any).validated = validated;
          } catch (e: any) {
            return res.status(422).json({
              error: 'Validation failed',
              details: e.errors || e.message,
            });
          }
        }
        
        return originalMethod.call(this, req, res);
      } catch (e: any) {
        return res.status(400).json({ error: 'Invalid request body' });
      }
    };
    
    return descriptor;
  };
}

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

  protected async render(viewName: string, data: Record<string, any> = {}, status: number = 200): Promise<Response> {
    return this.html(await renderView(viewName, data), status);
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

  // Additional response helpers
  protected created<T>(data: T): Response {
    return this.response.status(201).json(data);
  }

  protected noContent(): Response {
    return this.response.empty(204);
  }

  protected accepted<T>(data?: T): Response {
    return data ? this.response.status(202).json(data) : this.response.empty(202);
  }

  protected notFound(message: string = 'Not Found'): Response {
    return this.response.status(404).json({ error: message });
  }

  protected badRequest(message: string = 'Bad Request'): Response {
    return this.response.status(400).json({ error: message });
  }

  protected unauthorized(message: string = 'Unauthorized'): Response {
    return this.response.status(401).json({ error: message });
  }

  protected forbidden(message: string = 'Forbidden'): Response {
    return this.response.status(403).json({ error: message });
  }

  protected async validate<T = any>(schema: { parse: (data: any) => T } | { safeParse: (data: any) => any }): Promise<T> {
    const body = await this.body();
    
    if ('safeParse' in schema) {
        const result = schema.safeParse(body);
        if (!result.success) {
            throw { status: 422, message: 'Validation failed', details: result.error };
        }
        return result.data;
    } else if ('parse' in schema) {
        return schema.parse(body);
    }
    throw new Error('Invalid schema provided');
  }

  protected session(): any {
    return (this.request as any).session;
  }

  protected async validated<T>(): Promise<T> {
    return (this.request as any).validated as T;
  }
}

export default BaseController;

