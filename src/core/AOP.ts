/**
 * CanxJS Aspect-Oriented Programming (AOP)
 * Interceptors, Guards, and Pipes for cross-cutting concerns
 */

import type { CanxRequest, CanxResponse, NextFunction, MiddlewareHandler } from '../types';

// ============================================
// Types
// ============================================

export interface ExecutionContext {
  request: CanxRequest;
  response: CanxResponse;
  handler: Function;
  controller: any;
  methodName: string;
  args: any[];
}

export interface CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean>;
}

export interface Interceptor {
  intercept(context: ExecutionContext, next: () => Promise<any>): Promise<any>;
}

export interface PipeTransform<T = any, R = any> {
  transform(value: T, metadata?: any): R | Promise<R>;
}

export interface ExceptionFilter {
  catch(error: Error, context: ExecutionContext): void | Promise<void>;
}

// ============================================
// Guard Implementation
// ============================================

/**
 * Create a guard from a function
 */
export function createGuard(
  checkFn: (context: ExecutionContext) => boolean | Promise<boolean>
): CanActivate {
  return {
    canActivate: checkFn,
  };
}

/**
 * Apply guards to a handler
 */
export function applyGuards(
  guards: CanActivate[],
  handler: MiddlewareHandler
): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    const context: ExecutionContext = {
      request: req,
      response: res,
      handler,
      controller: null,
      methodName: '',
      args: [],
    };

    for (const guard of guards) {
      const canActivate = await guard.canActivate(context);
      if (!canActivate) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Access denied by guard',
        });
      }
    }

    return handler(req, res, next);
  };
}

// ============================================
// Interceptor Implementation
// ============================================

/**
 * Create an interceptor from a function
 */
export function createInterceptor(
  interceptFn: (context: ExecutionContext, next: () => Promise<any>) => Promise<any>
): Interceptor {
  return {
    intercept: interceptFn,
  };
}

/**
 * Apply interceptors to a handler
 */
export function applyInterceptors(
  interceptors: Interceptor[],
  handler: MiddlewareHandler
): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    const context: ExecutionContext = {
      request: req,
      response: res,
      handler,
      controller: null,
      methodName: '',
      args: [],
    };

    let result: any;
    
    // Build interceptor chain
    const chain = interceptors.reduceRight(
      (nextFn, interceptor) => {
        return async () => {
          return interceptor.intercept(context, nextFn);
        };
      },
      async () => handler(req, res, next)
    );

    return chain();
  };
}

// ============================================
// Pipe Implementation
// ============================================

/**
 * Create a pipe from a function
 */
export function createPipe<T, R>(
  transformFn: (value: T, metadata?: any) => R | Promise<R>
): PipeTransform<T, R> {
  return {
    transform: transformFn,
  };
}

/**
 * Common pipes
 */
export const ParseIntPipe: PipeTransform<string, number> = {
  transform(value: string): number {
    const val = parseInt(value, 10);
    if (isNaN(val)) {
      throw new Error(`Validation failed: "${value}" is not an integer`);
    }
    return val;
  },
};

export const ParseFloatPipe: PipeTransform<string, number> = {
  transform(value: string): number {
    const val = parseFloat(value);
    if (isNaN(val)) {
      throw new Error(`Validation failed: "${value}" is not a number`);
    }
    return val;
  },
};

export const ParseBoolPipe: PipeTransform<string, boolean> = {
  transform(value: string): boolean {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw new Error(`Validation failed: "${value}" is not a boolean`);
  },
};

export const TrimPipe: PipeTransform<string, string> = {
  transform(value: string): string {
    return typeof value === 'string' ? value.trim() : value;
  },
};

export const DefaultValuePipe = <T>(defaultValue: T): PipeTransform<T | undefined, T> => ({
  transform(value: T | undefined): T {
    return value !== undefined && value !== null ? value : defaultValue;
  },
});

// ============================================
// Exception Filter Implementation
// ============================================

/**
 * Create an exception filter from a function
 */
export function createExceptionFilter(
  catchFn: (error: Error, context: ExecutionContext) => void | Promise<void>
): ExceptionFilter {
  return {
    catch: catchFn,
  };
}

/**
 * Apply exception filters to a handler
 */
export function applyExceptionFilters(
  filters: ExceptionFilter[],
  handler: MiddlewareHandler
): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    const context: ExecutionContext = {
      request: req,
      response: res,
      handler,
      controller: null,
      methodName: '',
      args: [],
    };

    try {
      return await handler(req, res, next);
    } catch (error) {
      for (const filter of filters) {
        await filter.catch(error as Error, context);
      }
      // If no filter handles it, rethrow
      if (!res.headersSent) {
        throw error;
      }
    }
  };
}

// ============================================
// Decorator Metadata Storage
// ============================================

const guardMetadata = new Map<string, CanActivate[]>();
const interceptorMetadata = new Map<string, Interceptor[]>();
const pipeMetadata = new Map<string, PipeTransform[]>();

/**
 * UseGuards decorator
 */
export function UseGuards(...guards: Array<CanActivate | (new () => CanActivate)>): MethodDecorator & ClassDecorator {
  return function (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const key = propertyKey ? `${target.constructor.name}.${String(propertyKey)}` : target.name;
    const resolvedGuards = guards.map(g => 
      typeof g === 'function' ? new (g as new () => CanActivate)() : g
    );
    guardMetadata.set(key, resolvedGuards);
    return descriptor || target;
  };
}

/**
 * UseInterceptors decorator
 */
export function UseInterceptors(...interceptors: Array<Interceptor | (new () => Interceptor)>): MethodDecorator & ClassDecorator {
  return function (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const key = propertyKey ? `${target.constructor.name}.${String(propertyKey)}` : target.name;
    const resolvedInterceptors = interceptors.map(i => 
      typeof i === 'function' ? new (i as new () => Interceptor)() : i
    );
    interceptorMetadata.set(key, resolvedInterceptors);
    return descriptor || target;
  };
}

/**
 * UsePipes decorator
 */
export function UsePipes(...pipes: Array<PipeTransform | (new () => PipeTransform)>): MethodDecorator & ClassDecorator {
  return function (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const key = propertyKey ? `${target.constructor.name}.${String(propertyKey)}` : target.name;
    const resolvedPipes = pipes.map(p => 
      typeof p === 'function' ? new (p as new () => PipeTransform)() : p
    );
    pipeMetadata.set(key, resolvedPipes);
    return descriptor || target;
  };
}

/**
 * Get guard metadata
 */
export function getGuardMetadata(target: Function, propertyKey?: string): CanActivate[] {
  const key = propertyKey ? `${target.name}.${propertyKey}` : target.name;
  return guardMetadata.get(key) || [];
}

/**
 * Get interceptor metadata
 */
export function getInterceptorMetadata(target: Function, propertyKey?: string): Interceptor[] {
  const key = propertyKey ? `${target.name}.${propertyKey}` : target.name;
  return interceptorMetadata.get(key) || [];
}

export default { createGuard, createInterceptor, createPipe, createExceptionFilter };
