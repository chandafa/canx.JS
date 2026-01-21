/**
 * CanxJS Module System
 * NestJS-inspired modular architecture for organizing application features
 */

import type { MiddlewareHandler } from '../types';
import * as path from 'path';
import { Glob } from 'bun';

// ============================================
// Types
// ============================================

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
  useClass?: new (...args: any[]) => { createConfig(): T | Promise<T> };
  useExisting?: string | symbol;
}

export interface Provider {
  provide: string | symbol | Function; // Allow class constructor as token
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

// ============================================
// Module Base Class
// ============================================

export abstract class Module {
  private static metadata: Map<Function, ModuleMetadata> = new Map();
  private static instances: Map<string | symbol | Function, any> = new Map();

  /**
   * Get module metadata
   */
  static getMetadata(target: Function): ModuleMetadata | undefined {
    return this.metadata.get(target);
  }

  /**
   * Set module metadata
   */
  static setMetadata(target: Function, metadata: ModuleMetadata): void {
    this.metadata.set(target, metadata);
  }

  /**
   * Register a provider instance
   */
  /**
   * Auto-scan and import modules from a directory
   * @param globPattern Configurable glob pattern (default: '**\/*.module.{ts,js}')
   */
  static async scan(dir: string, globPattern: string = '**/*.module.{ts,js}'): Promise<DynamicModule> {
    const glob = new Bun.Glob(globPattern);
    const imports: any[] = [];
    const cwd = process.cwd();
    const absoluteDir = path.isAbsolute(dir) ? dir : path.join(cwd, dir);

    for await (const file of glob.scan({ cwd: absoluteDir, absolute: true })) {
       try {
         const moduleExports = await import(file);
         // Check for exported class decorated with @Module or @CanxModule
         for (const key in moduleExports) {
            const exported = moduleExports[key];
            if (typeof exported === 'function' && Module.getMetadata(exported)) {
               imports.push(exported);
            }
         }
       } catch (err) {
         console.warn(`[Module.scan] Failed to load ${file}:`, err);
       }
    }

    return {
       module: class AutoScannedModule {},
       imports,
    };
  }

  static registerInstance(token: string | symbol | Function, instance: any): void {
    this.instances.set(token, instance);
  }

  /**
   * Get a provider instance
   */
  static getInstance<T>(token: string | symbol | Function): T | undefined {
    return this.instances.get(token);
  }

  /**
   * Check if instance exists
   */
  static hasInstance(token: string | symbol | Function): boolean {
    return this.instances.has(token);
  }

  /**
   * Clear all instances (for testing)
   */
  static clearInstances(): void {
    this.instances.clear();
  }
}

// ============================================
// Module Decorator
// ============================================

const moduleMetadataStore = new Map<Function, ModuleMetadata>();
const globalModulesStore = new Set<Function>();
const lazyModulesStore = new Map<Function, () => Promise<any>>();

/**
 * Decorator to define a module
 */
export function CanxModule(metadata: ModuleMetadata): ClassDecorator {
  return function (target: Function) {
    moduleMetadataStore.set(target, metadata);
    Module.setMetadata(target, metadata);
  };
}



/**
 * Mark a module as global (available everywhere without importing)
 * @example
 * @Global()
 * @CanxModule({ providers: [ConfigService] })
 * class ConfigModule {}
 */
export function Global(): ClassDecorator {
  return function (target: Function) {
    globalModulesStore.add(target);
  };
}

/**
 * Check if a module is global
 */
export function isGlobalModule(target: Function): boolean {
  return globalModulesStore.has(target);
}

/**
 * Mark a module for lazy loading
 * @example
 * @LazyModule(() => import('./admin/AdminModule').then(m => m.AdminModule))
 */
export function LazyModule(loader: () => Promise<any>): ClassDecorator {
  return function (target: Function) {
    lazyModulesStore.set(target, loader);
  };
}

/**
 * Check if a module is lazy loaded
 */
export function isLazyModule(target: Function): boolean {
  return lazyModulesStore.has(target);
}

/**
 * Get lazy module loader
 */
export function getLazyModuleLoader(target: Function): (() => Promise<any>) | undefined {
  return lazyModulesStore.get(target);
}

/**
 * Get module metadata
 */
export function getModuleMetadata(target: Function): ModuleMetadata | undefined {
  return moduleMetadataStore.get(target);
}

/**
 * Check if value is a DynamicModule
 */
export function isDynamicModule(value: any): value is DynamicModule {
  return value && typeof value === 'object' && 'module' in value;
}

// ============================================
// Injectable Decorator
// ============================================

const injectableStore = new Set<Function>();
const injectMetadata = new Map<string, Array<string | symbol>>();

/**
 * Mark a class as injectable
 */
export function Injectable(): ClassDecorator {
  return function (target: Function) {
    injectableStore.add(target);
  };
}

/**
 * Check if class is injectable
 */
export function isInjectable(target: Function): boolean {
  return injectableStore.has(target);
}

/**
 * Inject decorator for constructor parameters
 */
export function Inject(token: string | symbol) {
  return function (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) {
    let key: string;
    
    // Constructor parameter
    if (!propertyKey && typeof target === 'function') {
      key = target.name;
    } else {
      // Method parameter or property
      key = target.constructor.name;
    }
    
    const existing = injectMetadata.get(key) || [];
    existing[parameterIndex] = token;
    injectMetadata.set(key, existing);
  };
}

/**
 * Get inject metadata for a class
 */
export function getInjectMetadata(target: Function): Array<string | symbol> {
  return injectMetadata.get(target.name) || [];
}

// ============================================
// Module Container
// ============================================

export class ModuleContainer implements ModuleRef {
  private instances: Map<string | symbol | Function, any> = new Map();
  private factories: Map<string | symbol | Function, () => any> = new Map();
  private asyncFactories: Map<string | symbol | Function, () => Promise<any>> = new Map();
  private modules: Array<Module | DynamicModule | (new () => Module)> = [];
  private globalProviders: Map<string | symbol | Function, any> = new Map();
  private lazyModules: Map<Function, Promise<any>> = new Map();
  private controllers: Set<any> = new Set();

  /**
   * Register a module (supports both static and dynamic modules)
   */
  register(moduleOrDynamic: (new () => Module) | DynamicModule): this {
    if (isDynamicModule(moduleOrDynamic)) {
      return this.registerDynamicModule(moduleOrDynamic);
    }
    
    const moduleClass = moduleOrDynamic;
    const metadata = getModuleMetadata(moduleClass);
    if (!metadata) {
      throw new Error(`Module ${moduleClass.name} has no metadata. Did you forget @CanxModule()?`);
    }

    // Check if module is global
    const isGlobal = isGlobalModule(moduleClass);

    // Register imported modules first
    if (metadata.imports) {
      for (const imported of metadata.imports) {
        if (isDynamicModule(imported)) {
          this.registerDynamicModule(imported);
        } else if (typeof imported === 'function') {
          this.register(imported as new () => Module);
        }
      }
    }

    // Register providers
    if (metadata.providers) {
      for (const provider of metadata.providers) {
        this.registerProvider(provider, isGlobal);
      }
    }

    // Register controllers
    if (metadata.controllers) {
      for (const controller of metadata.controllers) {
        // Controllers are just providers with extra metadata
        this.registerProvider(controller, false); 
        this.controllers.add(controller); // Add token/class, not instance
      }
    }

    this.modules.push(moduleClass);
    return this;
  }

  getControllers(): any[] {
    // Resolve instances when requested
    const instances: any[] = [];
    for (const controllerToken of this.controllers) {
        const instance = this.get(controllerToken);
        if (instance) instances.push(instance);
    }
    return instances;
  }

  /**
   * Register a dynamic module
   */
  registerDynamicModule(dynamicModule: DynamicModule): this {
    const { module, providers, imports, exports, global: isGlobal } = dynamicModule;

    // Register imported modules first
    if (imports) {
      for (const imported of imports) {
        if (isDynamicModule(imported)) {
          this.registerDynamicModule(imported);
        } else if (typeof imported === 'function') {
          this.register(imported as new () => Module);
        }
      }
    }

    // Register providers
    if (providers) {
      for (const provider of providers) {
        this.registerProvider(provider, isGlobal);
      }
    }

    this.modules.push(dynamicModule);
    return this;
  }

  /**
   * Register a lazy-loaded module (loads on first access)
   */
  async registerLazy(moduleClass: new () => Module): Promise<this> {
    const loader = getLazyModuleLoader(moduleClass);
    if (!loader) {
      throw new Error(`Module ${moduleClass.name} is not marked as lazy. Use @LazyModule() decorator.`);
    }

    // Check if already loading
    if (this.lazyModules.has(moduleClass)) {
      await this.lazyModules.get(moduleClass);
      return this;
    }

    // Load and register
    const loadPromise = (async () => {
      const loadedModule = await loader();
      this.register(loadedModule);
      return loadedModule;
    })();

    this.lazyModules.set(moduleClass, loadPromise);
    await loadPromise;
    return this;
  }

  /**
   * Register a provider
   */
  /**
   * Register a provider
   */
  registerProvider(provider: Provider | Function, isGlobal: boolean = false): void {
    let providerObj: Provider;
    
    if (typeof provider === 'function') {
      providerObj = {
        provide: provider,
        useClass: provider as any,
      };
    } else {
      providerObj = provider;
    }

    const token = providerObj.provide;

    if (providerObj.useValue !== undefined) {
      this.instances.set(token, providerObj.useValue);
      if (isGlobal) {
        this.globalProviders.set(token, providerObj.useValue);
      }
    } else if (providerObj.useClass) {
      const ClassRef = providerObj.useClass;
      this.factories.set(token, () => this.createInstance(ClassRef));
    } else if (providerObj.useFactory) {
      const deps = (providerObj.inject || []).map(dep => this.get(dep));
      this.factories.set(token, () => providerObj.useFactory!(...deps));
    }
  }

  /**
   * Register an async provider (for forRootAsync pattern)
   */
  /**
   * Register an async provider (for forRootAsync pattern)
   */
  registerAsync<T>(
    token: string | symbol | Function,
    options: AsyncModuleOptions<T>
  ): void {
    const factory = async () => {
      if (options.useFactory) {
        const deps = await Promise.all(
          (options.inject || []).map(dep => this.resolve(dep))
        );
        return options.useFactory(...deps);
      }
      if (options.useClass) {
        const instance = this.createInstance(options.useClass);
        return instance.createConfig();
      }
      if (options.useExisting) {
        return this.resolve(options.useExisting);
      }
      throw new Error('Invalid async provider configuration');
    };

    this.asyncFactories.set(token, factory);
  }

  /**
   * Create an instance with dependency injection
   */
  private createInstance<T>(ClassRef: new (...args: any[]) => T): T {
    const deps = getInjectMetadata(ClassRef);
    const resolvedDeps = deps.map(dep => this.get(dep));
    return new ClassRef(...resolvedDeps);
  }

  /**
   * Get a provider instance (sync)
   */
  get<T>(token: string | symbol | Function): T {
    // Check local instances
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check global providers
    if (this.globalProviders.has(token)) {
      return this.globalProviders.get(token);
    }

    // Check factories
    if (this.factories.has(token)) {
      const instance = this.factories.get(token)!();
      this.instances.set(token, instance);
      return instance;
    }

    throw new Error(`Provider not found: ${String(token)}`);
  }

  /**
   * Async resolve (supports async factories)
   */
  async resolve<T>(token: string | symbol | Function): Promise<T> {
    // Check local instances
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check global providers
    if (this.globalProviders.has(token)) {
      return this.globalProviders.get(token);
    }

    // Check async factories first
    if (this.asyncFactories.has(token)) {
      const instance = await this.asyncFactories.get(token)!();
      this.instances.set(token, instance);
      return instance;
    }

    // Check sync factories
    if (this.factories.has(token)) {
      const instance = this.factories.get(token)!();
      this.instances.set(token, instance);
      return instance;
    }

    throw new Error(`Provider not found: ${String(token)}`);
  }

  /**
   * Check if provider exists
   */
  has(token: string | symbol | Function): boolean {
    return this.instances.has(token) || 
           this.factories.has(token) || 
           this.asyncFactories.has(token) ||
           this.globalProviders.has(token);
  }

  /**
   * Get all registered modules
   */
  getModules(): Array<Module | DynamicModule | (new () => Module)> {
    return [...this.modules];
  }

  /**
   * Get all global providers
   */
  getGlobalProviders(): Map<string | symbol | Function, any> {
    return new Map(this.globalProviders);
  }

  /**
   * Trigger onModuleInit for all instances
   */
  async callOnModuleInit(): Promise<void> {
    for (const instance of this.instances.values()) {
      if (instance && typeof instance.onModuleInit === 'function') {
        await instance.onModuleInit();
      }
    }
  }

  /**
   * Trigger onApplicationBootstrap for all instances
   */
  async callOnApplicationBootstrap(): Promise<void> {
    for (const instance of this.instances.values()) {
      if (instance && typeof instance.onApplicationBootstrap === 'function') {
        await instance.onApplicationBootstrap();
      }
    }
  }

  /**
   * Trigger onModuleDestroy for all instances
   */
  async callOnModuleDestroy(): Promise<void> {
    for (const instance of this.instances.values()) {
      if (instance && typeof instance.onModuleDestroy === 'function') {
        await instance.onModuleDestroy();
      }
    }
  }

  /**
   * Trigger beforeApplicationShutdown for all instances
   */
  async callBeforeApplicationShutdown(signal?: string): Promise<void> {
    for (const instance of this.instances.values()) {
      if (instance && typeof instance.beforeApplicationShutdown === 'function') {
        await instance.beforeApplicationShutdown(signal);
      }
    }
  }

  /**
   * Trigger onApplicationShutdown for all instances
   */
  async callOnApplicationShutdown(signal?: string): Promise<void> {
    for (const instance of this.instances.values()) {
      if (instance && typeof instance.onApplicationShutdown === 'function') {
        await instance.onApplicationShutdown(signal);
      }
    }
  }
}



// ============================================
// Factory
// ============================================

/**
 * Create a new module container
 */
export function createModuleContainer(): ModuleContainer {
  return new ModuleContainer();
}

export default ModuleContainer;
