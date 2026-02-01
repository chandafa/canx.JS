/**
 * CanxJS Service Container - Dependency Injection Container with auto-wiring
 */
import { Scope, type InjectableOptions } from './Scope';
export { Scope } from './Scope';
type Constructor<T = unknown> = new (...args: unknown[]) => T;
type Factory<T> = () => T | Promise<T>;
type Resolver<T> = Constructor<T> | Factory<T> | ForwardRef<T>;
export interface ForwardRef<T = unknown> {
    forwardRef: true;
    resolve: () => Constructor<T>;
}
/**
 * Create a forward reference to break circular dependencies
 * @example
 * @Injectable()
 * class ServiceA {
 *   constructor(@Inject(forwardRef(() => ServiceB)) private b: ServiceB) {}
 * }
 */
export declare function forwardRef<T>(fn: () => Constructor<T>): ForwardRef<T>;
/**
 * Check if value is a ForwardRef
 */
export declare function isForwardRef(value: unknown): value is ForwardRef;
/**
 * Mark a class as injectable with optional scope configuration
 * @param options - Optional scope configuration
 * @example
 * @Injectable() // Singleton (default)
 * @Injectable({ scope: Scope.REQUEST }) // Per-request
 * @Injectable({ scope: Scope.TRANSIENT }) // New instance every time
 */
export declare function Injectable(options?: InjectableOptions): ClassDecorator;
/**
 * Inject a specific dependency by token or forward reference
 * @param token - Injection token, symbol, or forwardRef
 */
export declare function Inject(token: string | symbol | ForwardRef): ParameterDecorator;
/**
 * Register constructor parameter types for auto-wiring
 */
export declare function AutoWire(...types: Constructor[]): ClassDecorator;
export declare class Container {
    private bindings;
    private resolving;
    /**
     * Bind a class or factory to the container
     */
    /**
     * Bind a class or factory to the container
     */
    bind<T>(token: string | symbol | Constructor<T>, resolver: Resolver<T>, options?: {
        singleton?: boolean;
        scope?: Scope;
        tags?: string[];
    }): this;
    /**
     * Bind as singleton
     */
    singleton<T>(token: string | symbol | Constructor<T>, resolver: Resolver<T>, options?: {
        tags?: string[];
    }): this;
    /**
     * Bind an existing instance
     */
    instance<T>(token: string | symbol | Constructor<T>, instance: T): this;
    /**
     * Bind a factory function
     */
    factory<T>(token: string | symbol, factory: Factory<T>, options?: {
        singleton?: boolean;
        tags?: string[];
    }): this;
    /**
     * Check if binding exists
     */
    has(token: string | symbol | Constructor): boolean;
    /**
     * Resolve a dependency
     */
    resolve<T>(token: string | symbol | Constructor<T>): Promise<T>;
    /**
     * Resolve synchronously (for simple cases)
     */
    get<T>(token: string | symbol | Constructor<T>): T;
    /**
     * Resolve all bindings with a specific tag
     */
    tagged<T>(tag: string): Promise<T[]>;
    /**
     * Auto-resolve a class by inspecting its constructor
     */
    private autoResolve;
    /**
     * Synchronous auto-resolve
     */
    private autoResolveSync;
    /**
     * Check if a function is a class constructor
     */
    private isClass;
    /**
     * Create a child container
     */
    createChild(): Container;
    /**
     * Clear all bindings
     */
    clear(): void;
    /**
     * Register a service provider
     */
    register(provider: ServiceProvider): Promise<void>;
    /**
     * Boot all registered providers
     */
    boot(providers: ServiceProvider[]): Promise<void>;
}
export interface ServiceProvider {
    /**
     * Register bindings in the container
     */
    register(container: Container): void | Promise<void>;
    /**
     * Boot the provider (after all providers are registered)
     */
    boot?(container: Container): void | Promise<void>;
}
export declare class ScopedContainer extends Container {
    private parent;
    constructor(parent: Container);
    resolve<T>(token: string | symbol | Constructor<T>): Promise<T>;
    get<T>(token: string | symbol | Constructor<T>): T;
}
import type { MiddlewareHandler } from '../types';
export declare function containerMiddleware(container: Container): MiddlewareHandler;
export declare const container: Container;
export declare function bind<T>(token: string | symbol | Constructor<T>, resolver: Resolver<T>, options?: {
    singleton?: boolean;
    tags?: string[];
}): Container;
export declare function singleton<T>(token: string | symbol | Constructor<T>, resolver: Resolver<T>): Container;
export declare function resolve<T>(token: string | symbol | Constructor<T>): Promise<T>;
export default container;
