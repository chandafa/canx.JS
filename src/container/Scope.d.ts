/**
 * CanxJS Provider Scopes
 * NestJS-compatible injection scopes for dependency injection
 */
/**
 * Provider scope determines the lifetime of provider instances
 */
export declare enum Scope {
    /**
     * Default scope - Singleton instance shared across the entire application
     * Instance is created once and cached for all subsequent resolves
     */
    DEFAULT = "DEFAULT",
    /**
     * Request scope - New instance for each request
     * Instance is created once per HTTP request and shared within that request
     */
    REQUEST = "REQUEST",
    /**
     * Transient scope - New instance for every injection
     * Instance is created every time the dependency is resolved
     */
    TRANSIENT = "TRANSIENT"
}
export interface InjectableOptions {
    /**
     * Scope of the provider
     * @default Scope.DEFAULT
     */
    scope?: Scope;
}
/**
 * Async local storage for request context
 * Used to track request-scoped instances
 */
declare const requestContextStore: Map<string, Map<string | symbol, any>>;
/**
 * Generate unique request ID
 */
export declare function generateRequestId(): string;
/**
 * Set current request context
 */
export declare function setRequestContext(requestId: string): void;
/**
 * Get current request ID
 */
export declare function getRequestId(): string | null;
/**
 * Get request-scoped instance storage
 */
export declare function getRequestStorage(): Map<string | symbol, any> | null;
/**
 * Clear request context (call at end of request)
 */
export declare function clearRequestContext(requestId: string): void;
/**
 * Store instance in request context
 */
export declare function setRequestInstance<T>(token: string | symbol, instance: T): void;
/**
 * Get instance from request context
 */
export declare function getRequestInstance<T>(token: string | symbol): T | undefined;
/**
 * Check if instance exists in request context
 */
export declare function hasRequestInstance(token: string | symbol): boolean;
/**
 * Set scope for a class
 */
export declare function setScopeMetadata(target: object, scope: Scope): void;
/**
 * Get scope for a class
 */
export declare function getScopeMetadata(target: object): Scope;
import type { MiddlewareHandler } from '../types';
/**
 * Middleware to establish request context for scoped providers
 */
export declare function requestScopeMiddleware(): MiddlewareHandler;
/**
 * Run a function within a request context
 */
export declare function runInRequestContext<T>(fn: () => T | Promise<T>): Promise<T>;
/**
 * Run a function within a specific request context
 */
export declare function runWithRequestId<T>(requestId: string, fn: () => T | Promise<T>): Promise<T>;
export { requestContextStore, };
