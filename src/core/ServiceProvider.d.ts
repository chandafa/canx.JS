/**
 * CanxJS Service Provider
 * Base class for service registration and bootstrapping
 */
export interface Provider {
    register(): void | Promise<void>;
    boot?(): void | Promise<void>;
}
export declare abstract class ServiceProvider implements Provider {
    protected app: import("../container/Container").Container;
    /**
     * Register services into the container
     * Called before boot
     */
    abstract register(): void | Promise<void>;
    /**
     * Bootstrap services
     * Called after all providers are registered
     */
    boot?(): void | Promise<void>;
    /**
     * Helper to bind a singleton
     */
    protected singleton<T>(name: string, factory: () => T): void;
    /**
     * Helper to bind a factory
     */
    protected bind<T>(name: string, factory: () => T): void;
}
export declare class ApplicationKernel {
    private providers;
    private booted;
    /**
     * Register a service provider
     */
    register(provider: Provider | (new () => Provider)): this;
    /**
     * Register multiple providers
     */
    registerMany(providers: (Provider | (new () => Provider))[]): this;
    /**
     * Boot all registered providers
     */
    boot(): Promise<void>;
    /**
     * Check if booted
     */
    isBooted(): boolean;
}
export declare abstract class DeferredServiceProvider extends ServiceProvider {
    /**
     * Services that this provider provides
     * Used for deferred loading
     */
    abstract provides(): string[];
}
export declare function kernel(): ApplicationKernel;
export declare function initKernel(): ApplicationKernel;
export default ServiceProvider;
