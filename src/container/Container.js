"use strict";
/**
 * CanxJS Service Container - Dependency Injection Container with auto-wiring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = exports.ScopedContainer = exports.Container = exports.Scope = void 0;
exports.forwardRef = forwardRef;
exports.isForwardRef = isForwardRef;
exports.Injectable = Injectable;
exports.Inject = Inject;
exports.AutoWire = AutoWire;
exports.containerMiddleware = containerMiddleware;
exports.bind = bind;
exports.singleton = singleton;
exports.resolve = resolve;
const Scope_1 = require("./Scope");
// Re-export Scope
var Scope_2 = require("./Scope");
Object.defineProperty(exports, "Scope", { enumerable: true, get: function () { return Scope_2.Scope; } });
/**
 * Create a forward reference to break circular dependencies
 * @example
 * @Injectable()
 * class ServiceA {
 *   constructor(@Inject(forwardRef(() => ServiceB)) private b: ServiceB) {}
 * }
 */
function forwardRef(fn) {
    return {
        forwardRef: true,
        resolve: fn,
    };
}
/**
 * Check if value is a ForwardRef
 */
function isForwardRef(value) {
    return typeof value === 'object' && value !== null && value.forwardRef === true;
}
// Dependency metadata storage using WeakMap for broader compatibility
const injectMetadataStore = new WeakMap();
const injectableMetadataStore = new WeakMap();
const paramTypesStore = new WeakMap();
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
function Injectable(options) {
    return (target) => {
        injectableMetadataStore.set(target, true);
        if (options?.scope) {
            (0, Scope_1.setScopeMetadata)(target, options.scope);
        }
        return target;
    };
}
/**
 * Inject a specific dependency by token or forward reference
 * @param token - Injection token, symbol, or forwardRef
 */
function Inject(token) {
    return (target, propertyKey, parameterIndex) => {
        const existingInjections = injectMetadataStore.get(target) || [];
        existingInjections[parameterIndex] = token;
        injectMetadataStore.set(target, existingInjections);
    };
}
/**
 * Register constructor parameter types for auto-wiring
 */
function AutoWire(...types) {
    return (target) => {
        paramTypesStore.set(target, types);
        return target;
    };
}
// ============================================
// Container Class
// ============================================
class Container {
    bindings = new Map();
    resolving = new Set();
    /**
     * Bind a class or factory to the container
     */
    /**
     * Bind a class or factory to the container
     */
    bind(token, resolver, options = {}) {
        // Determine scope
        let scope = options.scope ?? Scope_1.Scope.DEFAULT;
        // If resolver is a class, check its metadata for scope
        if (typeof resolver === 'function' && this.isClass(resolver)) {
            const metaScope = (0, Scope_1.getScopeMetadata)(resolver);
            if (metaScope !== Scope_1.Scope.DEFAULT) {
                scope = metaScope;
            }
        }
        // Singleton option overrides to DEFAULT scope
        if (options.singleton) {
            scope = Scope_1.Scope.DEFAULT;
        }
        this.bindings.set(token, {
            resolver,
            singleton: scope === Scope_1.Scope.DEFAULT,
            scope,
            tags: options.tags || [],
        });
        return this;
    }
    /**
     * Bind as singleton
     */
    singleton(token, resolver, options = {}) {
        return this.bind(token, resolver, { ...options, singleton: true });
    }
    /**
     * Bind an existing instance
     */
    instance(token, instance) {
        this.bindings.set(token, {
            resolver: () => instance,
            singleton: true,
            scope: Scope_1.Scope.DEFAULT,
            instance,
            tags: [],
        });
        return this;
    }
    /**
     * Bind a factory function
     */
    factory(token, factory, options = {}) {
        return this.bind(token, factory, options);
    }
    /**
     * Check if binding exists
     */
    has(token) {
        return this.bindings.has(token);
    }
    /**
     * Resolve a dependency
     */
    async resolve(token) {
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
            return binding.instance;
        }
        this.resolving.add(token);
        try {
            let instance;
            if (typeof binding.resolver === 'function' && !this.isClass(binding.resolver)) {
                // Factory function
                instance = await binding.resolver();
            }
            else {
                // Class constructor
                instance = await this.autoResolve(binding.resolver);
            }
            if (binding.singleton) {
                binding.instance = instance;
            }
            return instance;
        }
        finally {
            this.resolving.delete(token);
        }
    }
    /**
     * Resolve synchronously (for simple cases)
     */
    get(token) {
        const binding = this.bindings.get(token);
        if (!binding) {
            if (typeof token === 'function') {
                return this.autoResolveSync(token);
            }
            throw new Error(`No binding found for: ${String(token)}`);
        }
        if (binding.singleton && binding.instance !== undefined) {
            return binding.instance;
        }
        if (typeof binding.resolver === 'function' && !this.isClass(binding.resolver)) {
            const instance = binding.resolver();
            if (binding.singleton)
                binding.instance = instance;
            return instance;
        }
        const instance = this.autoResolveSync(binding.resolver);
        if (binding.singleton)
            binding.instance = instance;
        return instance;
    }
    /**
     * Resolve all bindings with a specific tag
     */
    async tagged(tag) {
        const results = [];
        for (const [token, binding] of this.bindings) {
            if (binding.tags.includes(tag)) {
                results.push(await this.resolve(token));
            }
        }
        return results;
    }
    /**
     * Auto-resolve a class by inspecting its constructor
     */
    async autoResolve(target) {
        const paramTypes = paramTypesStore.get(target) || [];
        const injections = injectMetadataStore.get(target) || [];
        const dependencies = await Promise.all(paramTypes.map(async (type, index) => {
            // Check for explicit injection token (including ForwardRef)
            const injection = injections[index];
            if (injection) {
                if (isForwardRef(injection)) {
                    return this.resolve(injection.resolve());
                }
                return this.resolve(injection);
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
        }));
        return new target(...dependencies);
    }
    /**
     * Synchronous auto-resolve
     */
    autoResolveSync(target) {
        const paramTypes = paramTypesStore.get(target) || [];
        const injections = injectMetadataStore.get(target) || [];
        const dependencies = paramTypes.map((type, index) => {
            const injection = injections[index];
            if (injection) {
                if (isForwardRef(injection)) {
                    return this.get(injection.resolve());
                }
                return this.get(injection);
            }
            if (isForwardRef(type)) {
                return this.get(type.resolve());
            }
            if (type && type !== Object) {
                return this.get(type);
            }
            return undefined;
        });
        return new target(...dependencies);
    }
    /**
     * Check if a function is a class constructor
     */
    isClass(fn) {
        return /^class\s/.test(fn.toString()) ||
            injectableMetadataStore.get(fn) === true;
    }
    /**
     * Create a child container
     */
    createChild() {
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
    clear() {
        this.bindings.clear();
    }
    /**
     * Register a service provider
     */
    async register(provider) {
        await provider.register(this);
    }
    /**
     * Boot all registered providers
     */
    async boot(providers) {
        for (const provider of providers) {
            if (provider.boot) {
                await provider.boot(this);
            }
        }
    }
}
exports.Container = Container;
// ============================================
// Scoped Container (for request-scoped dependencies)
// ============================================
class ScopedContainer extends Container {
    parent;
    constructor(parent) {
        super();
        this.parent = parent;
    }
    async resolve(token) {
        // Check local bindings first
        if (this.has(token)) {
            return super.resolve(token);
        }
        // Fall back to parent
        return this.parent.resolve(token);
    }
    get(token) {
        if (this.has(token)) {
            return super.get(token);
        }
        return this.parent.get(token);
    }
}
exports.ScopedContainer = ScopedContainer;
function containerMiddleware(container) {
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
exports.container = new Container();
function bind(token, resolver, options) {
    return exports.container.bind(token, resolver, options);
}
function singleton(token, resolver) {
    return exports.container.singleton(token, resolver);
}
function resolve(token) {
    return exports.container.resolve(token);
}
exports.default = exports.container;
