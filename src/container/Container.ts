/**
 * CanxJS Service Container - Dependency Injection Container with auto-wiring
 */

import {
  Scope,
  getScopeMetadata,
  setScopeMetadata,
  getRequestInstance,
  setRequestInstance,
  hasRequestInstance,
  type InjectableOptions,
} from './Scope';

// Re-export Scope
export { Scope } from './Scope';

// ============================================
// Types
// ============================================

type Constructor<T = unknown> = new (...args: unknown[]) => T;
type Factory<T> = () => T | Promise<T>;
type Resolver<T> = Constructor<T> | Factory<T> | ForwardRef<T>;

interface Binding<T = unknown> {
  resolver: Resolver<T>;
  singleton: boolean;
  scope: Scope;
  instance?: T;
  tags: string[];
}

// ============================================
// ForwardRef for Circular Dependencies
// ============================================

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
export function forwardRef<T>(fn: () => Constructor<T>): ForwardRef<T> {
  return {
    forwardRef: true,
    resolve: fn,
  };
}

/**
 * Check if value is a ForwardRef
 */
export function isForwardRef(value: unknown): value is ForwardRef {
  return typeof value === 'object' && value !== null && (value as any).forwardRef === true;
}

// Dependency metadata storage using WeakMap for broader compatibility
const injectMetadataStore = new WeakMap<object, (string | symbol | ForwardRef | undefined)[]>();
const injectableMetadataStore = new WeakMap<object, boolean>();
const paramTypesStore = new WeakMap<object, (Constructor | ForwardRef)[]>();

// ============================================
// Decorators
// ============================================

/**
 * Mark a class as injectable with optional scope configuration
 * @param options - Optional scope configuration
 * @example
 * @Injectable() // Singleton (default)
 * @Injectable({ scope: Scope.REQUEST }) // Per-request
 * @Injectable({ scope: Scope.TRANSIENT }) // New instance every time
 */
export function Injectable(options?: InjectableOptions): ClassDecorator {
  return (target) => {
    injectableMetadataStore.set(target, true);
    if (options?.scope) {
      setScopeMetadata(target, options.scope);
    }
    return target;
  };
}

/**
 * Inject a specific dependency by token or forward reference
 * @param token - Injection token, symbol, or forwardRef
 */
export function Inject(token: string | symbol | ForwardRef): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const existingInjections = injectMetadataStore.get(target) || [];
    existingInjections[parameterIndex] = token;
    injectMetadataStore.set(target, existingInjections);
  };
}

/**
 * Register constructor parameter types for auto-wiring
 */
export function AutoWire(...types: Constructor[]): ClassDecorator {
  return (target) => {
    paramTypesStore.set(target, types);
    return target;
  };
}

// ============================================
// Container Class
// ============================================

export class Container {
  private bindings: Map<string | symbol | Constructor, Binding> = new Map();
  private resolving: Set<string | symbol | Constructor> = new Set();

  /**
   * Bind a class or factory to the container
   */
  /**
   * Bind a class or factory to the container
   */
  bind<T>(
    token: string | symbol | Constructor<T>,
    resolver: Resolver<T>,
    options: { singleton?: boolean; scope?: Scope; tags?: string[] } = {}
  ): this {
    // Determine scope
    let scope = options.scope ?? Scope.DEFAULT;
    
    // If resolver is a class, check its metadata for scope
    if (typeof resolver === 'function' && this.isClass(resolver)) {
      const metaScope = getScopeMetadata(resolver);
      if (metaScope !== Scope.DEFAULT) {
        scope = metaScope;
      }
    }
    
    // Singleton option overrides to DEFAULT scope
    if (options.singleton) {
      scope = Scope.DEFAULT;
    }
    
    this.bindings.set(token, {
      resolver,
      singleton: scope === Scope.DEFAULT,
      scope,
      tags: options.tags || [],
    });
    return this;
  }

  /**
   * Bind as singleton
   */
  singleton<T>(
    token: string | symbol | Constructor<T>,
    resolver: Resolver<T>,
    options: { tags?: string[] } = {}
  ): this {
    return this.bind(token, resolver, { ...options, singleton: true });
  }

  /**
   * Bind an existing instance
   */
  instance<T>(token: string | symbol | Constructor<T>, instance: T): this {
    this.bindings.set(token, {
      resolver: () => instance,
      singleton: true,
      scope: Scope.DEFAULT,
      instance,
      tags: [],
    });
    return this;
  }

  /**
   * Bind a factory function
   */
  factory<T>(
    token: string | symbol,
    factory: Factory<T>,
    options: { singleton?: boolean; tags?: string[] } = {}
  ): this {
    return this.bind(token, factory, options);
  }

  /**
   * Check if binding exists
   */
  has(token: string | symbol | Constructor): boolean {
    return this.bindings.has(token);
  }

  /**
   * Resolve a dependency
   */
  async resolve<T>(token: string | symbol | Constructor<T>): Promise<T> {
    // Check for circular dependency
    if (this.resolving.has(token)) {
      const name = typeof token === 'function' ? token.name : String(token);
      throw new Error(`Circular dependency detected while resolving: ${name}`);
    }

    const binding = this.bindings.get(token);

    if (!binding) {
      // Try to auto-resolve if it's a class
      if (typeof token === 'function') {
        return this.autoResolve(token);
      }
      throw new Error(`No binding found for: ${String(token)}`);
    }

    // Return cached singleton
    if (binding.singleton && binding.instance !== undefined) {
      return binding.instance as T;
    }

    this.resolving.add(token);

    try {
      let instance: T;

      if (typeof binding.resolver === 'function' && !this.isClass(binding.resolver)) {
        // Factory function
        instance = await (binding.resolver as Factory<T>)();
      } else {
        // Class constructor
        instance = await this.autoResolve(binding.resolver as Constructor<T>);
      }

      if (binding.singleton) {
        binding.instance = instance;
      }

      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }

  /**
   * Resolve synchronously (for simple cases)
   */
  get<T>(token: string | symbol | Constructor<T>): T {
    const binding = this.bindings.get(token);

    if (!binding) {
      if (typeof token === 'function') {
        return this.autoResolveSync(token);
      }
      throw new Error(`No binding found for: ${String(token)}`);
    }

    if (binding.singleton && binding.instance !== undefined) {
      return binding.instance as T;
    }

    if (typeof binding.resolver === 'function' && !this.isClass(binding.resolver)) {
      const instance = (binding.resolver as Factory<T>)() as T;
      if (binding.singleton) binding.instance = instance;
      return instance;
    }

    const instance = this.autoResolveSync(binding.resolver as Constructor<T>);
    if (binding.singleton) binding.instance = instance;
    return instance;
  }

  /**
   * Resolve all bindings with a specific tag
   */
  async tagged<T>(tag: string): Promise<T[]> {
    const results: T[] = [];
    
    for (const [token, binding] of this.bindings) {
      if (binding.tags.includes(tag)) {
        results.push(await this.resolve(token) as T);
      }
    }

    return results;
  }

  /**
   * Auto-resolve a class by inspecting its constructor
   */
  private async autoResolve<T>(target: Constructor<T>): Promise<T> {
    const paramTypes = paramTypesStore.get(target) || [];
    const injections = injectMetadataStore.get(target) || [];

    const dependencies = await Promise.all(
      paramTypes.map(async (type: Constructor | ForwardRef, index: number) => {
        // Check for explicit injection token (including ForwardRef)
        const injection = injections[index];
        if (injection) {
          if (isForwardRef(injection)) {
            return this.resolve(injection.resolve());
          }
          return this.resolve(injection as string | symbol);
        }
        // Handle ForwardRef in paramTypes
        if (isForwardRef(type)) {
          return this.resolve(type.resolve());
        }
        // Auto-resolve the type
        if (type && type !== Object) {
          return this.resolve(type);
        }
        return undefined;
      })
    );

    return new target(...dependencies);
  }

  /**
   * Synchronous auto-resolve
   */
  private autoResolveSync<T>(target: Constructor<T>): T {
    const paramTypes = paramTypesStore.get(target) || [];
    const injections = injectMetadataStore.get(target) || [];

    const dependencies = paramTypes.map((type: Constructor | ForwardRef, index: number) => {
      const injection = injections[index];
      if (injection) {
        if (isForwardRef(injection)) {
          return this.get(injection.resolve());
        }
        return this.get(injection as string | symbol);
      }
      if (isForwardRef(type)) {
        return this.get(type.resolve());
      }
      if (type && type !== Object) {
        return this.get(type as Constructor);
      }
      return undefined;
    });

    return new target(...dependencies);
  }

  /**
   * Check if a function is a class constructor
   */
  private isClass(fn: Function): boolean {
    return /^class\s/.test(fn.toString()) || 
           injectableMetadataStore.get(fn) === true;
  }

  /**
   * Create a child container
   */
  createChild(): Container {
    const child = new Container();
    // Copy bindings to child
    for (const [token, binding] of this.bindings) {
      child.bindings.set(token, { ...binding });
    }
    return child;
  }

  /**
   * Clear all bindings
   */
  clear(): void {
    this.bindings.clear();
  }

  /**
   * Register a service provider
   */
  async register(provider: ServiceProvider): Promise<void> {
    await provider.register(this);
  }

  /**
   * Boot all registered providers
   */
  async boot(providers: ServiceProvider[]): Promise<void> {
    for (const provider of providers) {
      if (provider.boot) {
        await provider.boot(this);
      }
    }
  }
}

// ============================================
// Service Provider Interface
// ============================================

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

// ============================================
// Scoped Container (for request-scoped dependencies)
// ============================================

export class ScopedContainer extends Container {
  private parent: Container;

  constructor(parent: Container) {
    super();
    this.parent = parent;
  }

  async resolve<T>(token: string | symbol | Constructor<T>): Promise<T> {
    // Check local bindings first
    if (this.has(token)) {
      return super.resolve(token);
    }
    // Fall back to parent
    return this.parent.resolve(token);
  }

  get<T>(token: string | symbol | Constructor<T>): T {
    if (this.has(token)) {
      return super.get(token);
    }
    return this.parent.get(token);
  }
}

// ============================================
// Request-scoped Middleware
// ============================================

import type { MiddlewareHandler } from '../types';

export function containerMiddleware(container: Container): MiddlewareHandler {
  return async (req, res, next) => {
    // Create a scoped container for this request
    const scoped = new ScopedContainer(container);
    
    // Bind request-specific instances
    scoped.instance('request', req);
    scoped.instance('response', res);
    
    // Attach to request context
    req.context.set('container', scoped);
    
    return next();
  };
}

// ============================================
// Global Container Instance
// ============================================

export const container = new Container();

export function bind<T>(
  token: string | symbol | Constructor<T>,
  resolver: Resolver<T>,
  options?: { singleton?: boolean; tags?: string[] }
): Container {
  return container.bind(token, resolver, options);
}

export function singleton<T>(
  token: string | symbol | Constructor<T>,
  resolver: Resolver<T>
): Container {
  return container.singleton(token, resolver);
}

export function resolve<T>(token: string | symbol | Constructor<T>): Promise<T> {
  return container.resolve(token);
}

export default container;
