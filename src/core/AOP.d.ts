/**
 * CanxJS Aspect-Oriented Programming (AOP)
 * Interceptors, Guards, and Pipes for cross-cutting concerns
 */
import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';
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
/**
 * Create a guard from a function
 */
export declare function createGuard(checkFn: (context: ExecutionContext) => boolean | Promise<boolean>): CanActivate;
/**
 * Apply guards to a handler
 */
export declare function applyGuards(guards: CanActivate[], handler: MiddlewareHandler): MiddlewareHandler;
/**
 * Create an interceptor from a function
 */
export declare function createInterceptor(interceptFn: (context: ExecutionContext, next: () => Promise<any>) => Promise<any>): Interceptor;
/**
 * Apply interceptors to a handler
 */
export declare function applyInterceptors(interceptors: Interceptor[], handler: MiddlewareHandler): MiddlewareHandler;
/**
 * Create a pipe from a function
 */
export declare function createPipe<T, R>(transformFn: (value: T, metadata?: any) => R | Promise<R>): PipeTransform<T, R>;
/**
 * Common pipes
 */
export declare const ParseIntPipe: PipeTransform<string, number>;
export declare const ParseFloatPipe: PipeTransform<string, number>;
export declare const ParseBoolPipe: PipeTransform<string, boolean>;
export declare const TrimPipe: PipeTransform<string, string>;
export declare const DefaultValuePipe: <T>(defaultValue: T) => PipeTransform<T | undefined, T>;
/**
 * Create an exception filter from a function
 */
export declare function createExceptionFilter(catchFn: (error: Error, context: ExecutionContext) => void | Promise<void>): ExceptionFilter;
/**
 * Apply exception filters to a handler
 */
export declare function applyExceptionFilters(filters: ExceptionFilter[], handler: MiddlewareHandler): MiddlewareHandler;
/**
 * UseGuards decorator
 */
export declare function UseGuards(...guards: Array<CanActivate | (new () => CanActivate)>): MethodDecorator & ClassDecorator;
/**
 * UseInterceptors decorator
 */
export declare function UseInterceptors(...interceptors: Array<Interceptor | (new () => Interceptor)>): MethodDecorator & ClassDecorator;
/**
 * UsePipes decorator
 */
export declare function UsePipes(...pipes: Array<PipeTransform | (new () => PipeTransform)>): MethodDecorator & ClassDecorator;
/**
 * Get guard metadata
 */
export declare function getGuardMetadata(target: Function, propertyKey?: string): CanActivate[];
/**
 * Get interceptor metadata
 */
export declare function getInterceptorMetadata(target: Function, propertyKey?: string): Interceptor[];
declare const _default: {
    createGuard: typeof createGuard;
    createInterceptor: typeof createInterceptor;
    createPipe: typeof createPipe;
    createExceptionFilter: typeof createExceptionFilter;
};
export default _default;
