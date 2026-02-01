/**
 * CanxJS API Versioning
 * URL and Header-based API versioning middleware
 */
import type { MiddlewareHandler } from '../types';
export interface VersioningConfig {
    type: 'url' | 'header' | 'query' | 'accept';
    default?: string;
    header?: string;
    query?: string;
    prefix?: string;
    versions?: string[];
}
export interface VersionedRoute {
    version: string;
    handler: MiddlewareHandler;
}
/**
 * API Versioning middleware
 * Extracts version from request and adds to req.version
 */
export declare function versioning(config?: Partial<VersioningConfig>): MiddlewareHandler;
/**
 * Create versioned route handlers
 * Routes requests to appropriate handler based on version
 */
export declare function versionedHandler(handlers: Record<string, MiddlewareHandler>, defaultVersion?: string): MiddlewareHandler;
/**
 * Decorator to mark controller or method version
 */
export declare function Version(version: string): (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => any;
/**
 * Get version from decorator metadata
 */
export declare function getVersion(target: any, propertyKey?: string): string | undefined;
/**
 * Middleware to strip version prefix from URL for routing
 * Useful when you want /v1/users to be handled by /users route
 */
export declare function stripVersionPrefix(prefix?: string): MiddlewareHandler;
export declare const urlVersioning: (versions?: string[]) => MiddlewareHandler;
export declare const headerVersioning: (versions?: string[]) => MiddlewareHandler;
export declare const queryVersioning: (versions?: string[]) => MiddlewareHandler;
export default versioning;
