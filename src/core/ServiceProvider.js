"use strict";
/**
 * CanxJS Service Provider
 * Base class for service registration and bootstrapping
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeferredServiceProvider = exports.ApplicationKernel = exports.ServiceProvider = void 0;
exports.kernel = kernel;
exports.initKernel = initKernel;
const Container_1 = require("../container/Container");
// ============================================
// Service Provider Base Class
// ============================================
class ServiceProvider {
    app = Container_1.container;
    /**
     * Helper to bind a singleton
     */
    singleton(name, factory) {
        Container_1.container.singleton(name, factory);
    }
    /**
     * Helper to bind a factory
     */
    bind(name, factory) {
        Container_1.container.bind(name, factory);
    }
}
exports.ServiceProvider = ServiceProvider;
// ============================================
// Application Kernel
// ============================================
class ApplicationKernel {
    providers = [];
    booted = false;
    /**
     * Register a service provider
     */
    register(provider) {
        const instance = typeof provider === 'function' ? new provider() : provider;
        this.providers.push(instance);
        return this;
    }
    /**
     * Register multiple providers
     */
    registerMany(providers) {
        for (const provider of providers) {
            this.register(provider);
        }
        return this;
    }
    /**
     * Boot all registered providers
     */
    async boot() {
        if (this.booted)
            return;
        // Register phase
        for (const provider of this.providers) {
            await provider.register();
        }
        // Boot phase
        for (const provider of this.providers) {
            if (provider.boot) {
                await provider.boot();
            }
        }
        this.booted = true;
    }
    /**
     * Check if booted
     */
    isBooted() {
        return this.booted;
    }
}
exports.ApplicationKernel = ApplicationKernel;
// ============================================
// Deferred Provider (for lazy loading)
// ============================================
class DeferredServiceProvider extends ServiceProvider {
}
exports.DeferredServiceProvider = DeferredServiceProvider;
// ============================================
// Singleton Kernel
// ============================================
let kernelInstance = null;
function kernel() {
    if (!kernelInstance) {
        kernelInstance = new ApplicationKernel();
    }
    return kernelInstance;
}
function initKernel() {
    kernelInstance = new ApplicationKernel();
    return kernelInstance;
}
exports.default = ServiceProvider;
