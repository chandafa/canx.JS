/**
 * CanxJS Middleware - Async-first pipeline with error boundaries
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler, NextFunction } from '../types';
import { createCanxRequest, createCanxResponse } from './Server';

export class MiddlewarePipeline {
  private middlewares: MiddlewareHandler[] = [];

  use(...handlers: MiddlewareHandler[]): this {
    this.middlewares.push(...handlers);
    return this;
  }

  async execute(
    req: CanxRequest,
    res: CanxResponse,
    routeMiddlewares: MiddlewareHandler[],
    finalHandler: () => Promise<Response> | Response
  ): Promise<Response> {
    const allMiddlewares = [...this.middlewares, ...routeMiddlewares];
    let index = 0;

    const next: NextFunction = async () => {
      if (index >= allMiddlewares.length) {
        return finalHandler();
      }
      const middleware = allMiddlewares[index++];
      const result = await middleware(req, res, next);
      return result || undefined;
    };

    try {
      const result = await next();
      return result || new Response('No response', { status: 500 });
    } catch (error) {
      console.error('[CanxJS Middleware Error]', error);
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
}

// Built-in middlewares
export const cors = (options: { origin?: string | string[]; methods?: string[]; credentials?: boolean } = {}): MiddlewareHandler => {
  return async (req, res, next) => {
    const origin = Array.isArray(options.origin) ? options.origin[0] : (options.origin || '*');
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', options.methods?.join(', ') || 'GET,POST,PUT,DELETE,OPTIONS');
    if (options.credentials) res.header('Access-Control-Allow-Credentials', 'true');
    return next();
  };
};

export const logger = (): MiddlewareHandler => {
  return async (req, res, next) => {
    const start = performance.now();
    const result = await next();
    const duration = (performance.now() - start).toFixed(2);
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${duration}ms`);
    return result;
  };
};

export const bodyParser = (): MiddlewareHandler => {
  return async (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      await req.body();
    }
    return next();
  };
};

export const rateLimit = (options: { windowMs?: number; max?: number } = {}): MiddlewareHandler => {
  const { windowMs = 60000, max = 100 } = options;
  const requests = new Map<string, { count: number; resetAt: number }>();

  return async (req, res, next) => {
    const ip = req.header('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const record = requests.get(ip);

    if (!record || now > record.resetAt) {
      requests.set(ip, { count: 1, resetAt: now + windowMs });
    } else if (record.count >= max) {
      return res.status(429).json({ error: 'Too many requests' });
    } else {
      record.count++;
    }
    return next();
  };
};

export const compress = (): MiddlewareHandler => {
  return async (req, res, next) => {
    const accept = req.header('accept-encoding') || '';
    if (accept.includes('gzip')) {
      res.header('Content-Encoding', 'gzip');
    }
    return next();
  };
};

export function createMiddlewarePipeline(): MiddlewarePipeline {
  return new MiddlewarePipeline();
}

export default MiddlewarePipeline;
