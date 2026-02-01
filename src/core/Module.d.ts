/**
 * CanxJS Module System
 * NestJS-inspired modular architecture for organizing application features
 */
import type { MiddlewareHandler } from '../types';
export interface ModuleMetadata {
    imports?: Array<Module | DynamicModule | (new () => Module)>;
    controllers?: Array<new (...args: any[]) => any>;
    providers?: Array<Provider | Function>;
    exports?: Array<string | Provider | Function>;
    middleware?: MiddlewareHandler[];
}
export interface DynamicModule {
    module: new (...args: any[]) => any;
    imports?: Array<Module | DynamicModule | (new () => Module)>;
    controllers?: Array<new (...args: any[]) => any>;
    providers?: Array<Provider | Function>;
    exports?: Array<string | Provider | Function>;
    global?: boolean;
}
export interface AsyncModuleOptions<T = any> {
    imports?: Array<Module | DynamicModule | (new () => Module)>;
    useFactory: (...args: any[]) => T | Promise<T>;
    inject?: Array<string | symbol>;
    useClass?: new (...args: any[]) => {
        createConfig(): T | Promise<T>;
    };
    useExisting?: string | symbol;
}
export interface Provider {
    provide: string | symbol | Function;
    useClass?: new (...args: any[]) => any;
    useValue?: any;
    useFactory?: (...args: any[]) => any;
    inject?: Array<string | symbol | Function>;
    scope?: 'singleton' | 'request' | 'transient';
}
export interface ModuleRef {
    get<T>(token: string | symbol | Function): T;
    resolve<T>(token: string | symbol | Function): Promise<T>;
}
export declare abstract class Module {
    private static metadata;
    private static instances;
    /**
     * Get module metadata
     */
    static getMetadata(target: Function): ModuleMetadata | undefined;
    /**
     * Set module metadata
     */
    static setMetadata(target: Function, metadata: ModuleMetadata): void;
    /**
     * Register a provider instance
     */
    /**
     * Auto-scan and import modules from a directory
     * @param globPattern Configurable glob pattern (default: '**\/*.module.{ts,js}')
     */
    static scan(dir: string, globPattern?: string): Promise<DynamicModule>;
    static registerInstance(token: string | symbol | Function, instance: any): void;
    /**
     * Get a provider instance
     */
    static getInstance<T>(token: string | symbol | Function): T | undefined;
    /**
     * Check if instance exists
     */
    static hasInstance(token: string | symbol | Function): boolean;
    /**
     * Clear all instances (for testing)
     */
    static clearInstances(): void;
}
/**
 * Decorator to define a module
 */
export declare function CanxModule(metadata: ModuleMetadata): ClassDecorator;
/**
 * Mark a module as global (available everywhere without importing)
 * @example
 * @Global()
 * @CanxModule({ providers: [ConfigService] })
 * class ConfigModule {}
 */
export declare function Global(): ClassDecorator;
/**
 * Check if a module is global
 */
export declare function isGlobalModule(target: Function): boolean;
/**
 * Mark a module for lazy loading
 * @example
 * @LazyModule(() => import('./admin/AdminModule').then(m => m.AdminModule))
 */
export declare function LazyModule(loader: () => Promise<any>): ClassDecorator;
/**
 * Check if a module is lazy loaded
 */
export declare function isLazyModule(target: Function): boolean;
/**
 * Get lazy module loader
 */
export declare function getLazyModuleLoader(target: Function): (() => Promise<any>) | undefined;
/**
 * Get module metadata
 */
export declare function getModuleMetadata(target: Function): ModuleMetadata | undefined;
/**
 * Check if value is a DynamicModule
 */
export declare function isDynamicModule(value: any): value is DynamicModule;
/**
 * Mark a class as injectable
 */
export declare function Injectable(): ClassDecorator;
/**
 * Check if class is injectable
 */
export declare function isInjectable(target: Function): boolean;
/**
 * Inject decorator for constructor parameters
 */
export declare function Inject(token: string | symbol): (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => void;
/**
 * Get inject metadata for a class
 */
export declare function getInjectMetadata(target: Function): Array<string | symbol>;
export declare class ModuleContainer implements ModuleRef {
    private instances;
    private factories;
    private asyncFactories;
    private modules;
    private globalProviders;
    private lazyModules;
    private controllers;
    /**
     * Register a module (supports both static and dynamic modules)
     */
    register(moduleOrDynamic: (new () => Module) | DynamicModule): this;
    getControllers(): any[];
    /**
     * Register a dynamic module
     */
    registerDynamicModule(dynamicModule: DynamicModule): this;
    /**
     * Register a lazy-loaded module (loads on first access)
     */
    registerLazy(moduleClass: new () => Module): Promise<this>;
    /**
     * Register a provider
     */
    /**
     * Register a provider
     */
    registerProvider(provider: Provider | Function, isGlobal?: boolean): void;
    /**
     * Register an async provider (for forRootAsync pattern)
     */
    /**
     * Register an async provider (for forRootAsync pattern)
     */
    registerAsync<T>(token: string | symbol | Function, options: AsyncModuleOptions<T>): void;
    /**
     * Create an instance with dependency injection
     */
    private createInstance;
    /**
     * Get a provider instance (sync)
     */
    get<T>(token: string | symbol | Function): T;
    /**
     * Async resolve (supports async factories)
     */
    resolve<T>(token: string | symbol | Function): Promise<T>;
    /**
     * Check if provider exists
     */
    has(token: string | symbol | Function): boolean;
    /**
     * Get all registered modules
     */
    getModules(): Array<Module | DynamicModule | (new () => Module)>;
    /**
     * Get all global providers
     */
    getGlobalProviders(): Map<string | symbol | Function, any>;
    /**
     * Trigger onModuleInit for all instances
     */
    callOnModuleInit(): Promise<void>;
    /**
     * Trigger onApplicationBootstrap for all instances
     */
    callOnApplicationBootstrap(): Promise<void>;
    /**
     * Trigger onModuleDestroy for all instances
     */
    callOnModuleDestroy(): Promise<void>;
    /**
     * Trigger beforeApplicationShutdown for all instances
     */
    callBeforeApplicationShutdown(signal?: string): Promise<void>;
    /**
     * Trigger onApplicationShutdown for all instances
     */
    callOnApplicationShutdown(signal?: string): Promise<void>;
}
/**
 * Create a new module container
 */
export declare function createModuleContainer(): ModuleContainer;
export default ModuleContainer;
