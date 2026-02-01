"use strict";
/**
 * CanxJS Module System
 * NestJS-inspired modular architecture for organizing application features
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleContainer = exports.Module = void 0;
exports.CanxModule = CanxModule;
exports.Global = Global;
exports.isGlobalModule = isGlobalModule;
exports.LazyModule = LazyModule;
exports.isLazyModule = isLazyModule;
exports.getLazyModuleLoader = getLazyModuleLoader;
exports.getModuleMetadata = getModuleMetadata;
exports.isDynamicModule = isDynamicModule;
exports.Injectable = Injectable;
exports.isInjectable = isInjectable;
exports.Inject = Inject;
exports.getInjectMetadata = getInjectMetadata;
exports.createModuleContainer = createModuleContainer;
const path = __importStar(require("path"));
// ============================================
// Module Base Class
// ============================================
class Module {
    static metadata = new Map();
    static instances = new Map();
    /**
     * Get module metadata
     */
    static getMetadata(target) {
        return this.metadata.get(target);
    }
    /**
     * Set module metadata
     */
    static setMetadata(target, metadata) {
        this.metadata.set(target, metadata);
    }
    /**
     * Register a provider instance
     */
    /**
     * Auto-scan and import modules from a directory
     * @param globPattern Configurable glob pattern (default: '**\/*.module.{ts,js}')
     */
    static async scan(dir, globPattern = '**/*.module.{ts,js}') {
        const glob = new Bun.Glob(globPattern);
        const imports = [];
        const cwd = process.cwd();
        const absoluteDir = path.isAbsolute(dir) ? dir : path.join(cwd, dir);
        for await (const file of glob.scan({ cwd: absoluteDir, absolute: true })) {
            try {
                const moduleExports = await Promise.resolve(`${file}`).then(s => __importStar(require(s)));
                // Check for exported class decorated with @Module or @CanxModule
                for (const key in moduleExports) {
                    const exported = moduleExports[key];
                    if (typeof exported === 'function' && Module.getMetadata(exported)) {
                        imports.push(exported);
                    }
                }
            }
            catch (err) {
                console.warn(`[Module.scan] Failed to load ${file}:`, err);
            }
        }
        return {
            module: class AutoScannedModule {
            },
            imports,
        };
    }
    static registerInstance(token, instance) {
        this.instances.set(token, instance);
    }
    /**
     * Get a provider instance
     */
    static getInstance(token) {
        return this.instances.get(token);
    }
    /**
     * Check if instance exists
     */
    static hasInstance(token) {
        return this.instances.has(token);
    }
    /**
     * Clear all instances (for testing)
     */
    static clearInstances() {
        this.instances.clear();
    }
}
exports.Module = Module;
// ============================================
// Module Decorator
// ============================================
const moduleMetadataStore = new Map();
const globalModulesStore = new Set();
const lazyModulesStore = new Map();
/**
 * Decorator to define a module
 */
function CanxModule(metadata) {
    return function (target) {
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
function Global() {
    return function (target) {
        globalModulesStore.add(target);
    };
}
/**
 * Check if a module is global
 */
function isGlobalModule(target) {
    return globalModulesStore.has(target);
}
/**
 * Mark a module for lazy loading
 * @example
 * @LazyModule(() => import('./admin/AdminModule').then(m => m.AdminModule))
 */
function LazyModule(loader) {
    return function (target) {
        lazyModulesStore.set(target, loader);
    };
}
/**
 * Check if a module is lazy loaded
 */
function isLazyModule(target) {
    return lazyModulesStore.has(target);
}
/**
 * Get lazy module loader
 */
function getLazyModuleLoader(target) {
    return lazyModulesStore.get(target);
}
/**
 * Get module metadata
 */
function getModuleMetadata(target) {
    return moduleMetadataStore.get(target);
}
/**
 * Check if value is a DynamicModule
 */
function isDynamicModule(value) {
    return value && typeof value === 'object' && 'module' in value;
}
// ============================================
// Injectable Decorator
// ============================================
const injectableStore = new Set();
const injectMetadata = new Map();
/**
 * Mark a class as injectable
 */
function Injectable() {
    return function (target) {
        injectableStore.add(target);
    };
}
/**
 * Check if class is injectable
 */
function isInjectable(target) {
    return injectableStore.has(target);
}
/**
 * Inject decorator for constructor parameters
 */
function Inject(token) {
    return function (target, propertyKey, parameterIndex) {
        let key;
        // Constructor parameter
        if (!propertyKey && typeof target === 'function') {
            key = target.name;
        }
        else {
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
function getInjectMetadata(target) {
    return injectMetadata.get(target.name) || [];
}
// ============================================
// Module Container
// ============================================
class ModuleContainer {
    instances = new Map();
    factories = new Map();
    asyncFactories = new Map();
    modules = [];
    globalProviders = new Map();
    lazyModules = new Map();
    controllers = new Set();
    /**
     * Register a module (supports both static and dynamic modules)
     */
    register(moduleOrDynamic) {
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
                }
                else if (typeof imported === 'function') {
                    this.register(imported);
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
    getControllers() {
        // Resolve instances when requested
        const instances = [];
        for (const controllerToken of this.controllers) {
            const instance = this.get(controllerToken);
            if (instance)
                instances.push(instance);
        }
        return instances;
    }
    /**
     * Register a dynamic module
     */
    registerDynamicModule(dynamicModule) {
        const { module, providers, imports, exports, global: isGlobal } = dynamicModule;
        // Register imported modules first
        if (imports) {
            for (const imported of imports) {
                if (isDynamicModule(imported)) {
                    this.registerDynamicModule(imported);
                }
                else if (typeof imported === 'function') {
                    this.register(imported);
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
    async registerLazy(moduleClass) {
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
    registerProvider(provider, isGlobal = false) {
        let providerObj;
        if (typeof provider === 'function') {
            providerObj = {
                provide: provider,
                useClass: provider,
            };
        }
        else {
            providerObj = provider;
        }
        const token = providerObj.provide;
        if (providerObj.useValue !== undefined) {
            this.instances.set(token, providerObj.useValue);
            if (isGlobal) {
                this.globalProviders.set(token, providerObj.useValue);
            }
        }
        else if (providerObj.useClass) {
            const ClassRef = providerObj.useClass;
            this.factories.set(token, () => this.createInstance(ClassRef));
        }
        else if (providerObj.useFactory) {
            const deps = (providerObj.inject || []).map(dep => this.get(dep));
            this.factories.set(token, () => providerObj.useFactory(...deps));
        }
    }
    /**
     * Register an async provider (for forRootAsync pattern)
     */
    /**
     * Register an async provider (for forRootAsync pattern)
     */
    registerAsync(token, options) {
        const factory = async () => {
            if (options.useFactory) {
                const deps = await Promise.all((options.inject || []).map(dep => this.resolve(dep)));
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
    createInstance(ClassRef) {
        const deps = getInjectMetadata(ClassRef);
        const resolvedDeps = deps.map(dep => this.get(dep));
        return new ClassRef(...resolvedDeps);
    }
    /**
     * Get a provider instance (sync)
     */
    get(token) {
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
            const instance = this.factories.get(token)();
            this.instances.set(token, instance);
            return instance;
        }
        throw new Error(`Provider not found: ${String(token)}`);
    }
    /**
     * Async resolve (supports async factories)
     */
    async resolve(token) {
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
            const instance = await this.asyncFactories.get(token)();
            this.instances.set(token, instance);
            return instance;
        }
        // Check sync factories
        if (this.factories.has(token)) {
            const instance = this.factories.get(token)();
            this.instances.set(token, instance);
            return instance;
        }
        throw new Error(`Provider not found: ${String(token)}`);
    }
    /**
     * Check if provider exists
     */
    has(token) {
        return this.instances.has(token) ||
            this.factories.has(token) ||
            this.asyncFactories.has(token) ||
            this.globalProviders.has(token);
    }
    /**
     * Get all registered modules
     */
    getModules() {
        return [...this.modules];
    }
    /**
     * Get all global providers
     */
    getGlobalProviders() {
        return new Map(this.globalProviders);
    }
    /**
     * Trigger onModuleInit for all instances
     */
    async callOnModuleInit() {
        for (const instance of this.instances.values()) {
            if (instance && typeof instance.onModuleInit === 'function') {
                await instance.onModuleInit();
            }
        }
    }
    /**
     * Trigger onApplicationBootstrap for all instances
     */
    async callOnApplicationBootstrap() {
        for (const instance of this.instances.values()) {
            if (instance && typeof instance.onApplicationBootstrap === 'function') {
                await instance.onApplicationBootstrap();
            }
        }
    }
    /**
     * Trigger onModuleDestroy for all instances
     */
    async callOnModuleDestroy() {
        for (const instance of this.instances.values()) {
            if (instance && typeof instance.onModuleDestroy === 'function') {
                await instance.onModuleDestroy();
            }
        }
    }
    /**
     * Trigger beforeApplicationShutdown for all instances
     */
    async callBeforeApplicationShutdown(signal) {
        for (const instance of this.instances.values()) {
            if (instance && typeof instance.beforeApplicationShutdown === 'function') {
                await instance.beforeApplicationShutdown(signal);
            }
        }
    }
    /**
     * Trigger onApplicationShutdown for all instances
     */
    async callOnApplicationShutdown(signal) {
        for (const instance of this.instances.values()) {
            if (instance && typeof instance.onApplicationShutdown === 'function') {
                await instance.onApplicationShutdown(signal);
            }
        }
    }
}
exports.ModuleContainer = ModuleContainer;
// ============================================
// Factory
// ============================================
/**
 * Create a new module container
 */
function createModuleContainer() {
    return new ModuleContainer();
}
exports.default = ModuleContainer;
