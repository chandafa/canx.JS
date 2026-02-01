/**
 * CanxJS Controller - Base class with decorators and dependency injection
 */
import type { CanxRequest, CanxResponse, MiddlewareHandler, ControllerMeta } from '../types';
export declare function getControllerMeta(target: object): ControllerMeta;
export declare function Controller(prefix?: string): ClassDecorator;
export declare function Middleware(...middlewares: MiddlewareHandler[]): MethodDecorator & ClassDecorator;
export declare const Get: (path?: string) => MethodDecorator;
export declare const Post: (path?: string) => MethodDecorator;
export declare const Put: (path?: string) => MethodDecorator;
export declare const Patch: (path?: string) => MethodDecorator;
export declare const Delete: (path?: string) => MethodDecorator;
export declare const Options: (path?: string) => MethodDecorator;
export declare const Head: (path?: string) => MethodDecorator;
/**
 * Wrap a controller method to automatically resolve parameter decorators
 * This is called by the Router when registering controller routes
 */
export declare function wrapWithParamResolution(controller: any, methodName: string, originalMethod: Function): (req: CanxRequest, res: CanxResponse) => Promise<Response>;
/**
 * Validate decorator - validates request body against a schema
 * @param schema - Zod-like schema with parse/safeParse method
 */
export declare function Validate(schema: {
    parse?: (data: any) => any;
    safeParse?: (data: any) => {
        success: boolean;
        data?: any;
        error?: any;
    };
}): MethodDecorator;
export declare abstract class BaseController {
    protected request: CanxRequest;
    protected response: CanxResponse;
    setContext(req: CanxRequest, res: CanxResponse): void;
    protected json<T>(data: T, status?: number): Response;
    protected html(content: string, status?: number): Response;
    protected render(viewName: string, data?: Record<string, any>, status?: number): Promise<Response>;
    protected redirect(url: string, status?: 301 | 302): Response;
    protected param(key: string): string | undefined;
    protected query(key: string): string | string[] | undefined;
    protected body<T = unknown>(): Promise<T>;
    protected header(name: string): string | null;
    protected cookie(name: string): string | undefined;
    protected setCookie(name: string, value: string, options?: any): void;
    protected created<T>(data: T): Response;
    protected noContent(): Response;
    protected accepted<T>(data?: T): Response;
    protected notFound(message?: string): Response;
    protected badRequest(message?: string): Response;
    protected unauthorized(message?: string): Response;
    protected forbidden(message?: string): Response;
    protected validate<T = any>(schema: {
        parse: (data: any) => T;
    } | {
        safeParse: (data: any) => any;
    }): Promise<T>;
    protected session(): any;
    protected validated<T>(): Promise<T>;
}
export default BaseController;
