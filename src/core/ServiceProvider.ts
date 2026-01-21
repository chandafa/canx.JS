/**
 * CanxJS Service Provider
 * Base class for service registration and bootstrapping
 */

import { container } from '../container/Container';

// ============================================
// Types
// ============================================

export interface Provider {
  register(): void | Promise<void>;
  boot?(): void | Promise<void>;
}

// ============================================
// Service Provider Base Class
// ============================================

export abstract class ServiceProvider implements Provider {
  protected app = container;

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
  protected singleton<T>(name: string, factory: () => T): void {
    container.singleton(name, factory);
  }

  /**
   * Helper to bind a factory
   */
  protected bind<T>(name: string, factory: () => T): void {
    container.bind(name, factory);
  }
}

// ============================================
// Application Kernel
// ============================================

export class ApplicationKernel {
  private providers: Provider[] = [];
  private booted = false;

  /**
   * Register a service provider
   */
  register(provider: Provider | (new () => Provider)): this {
    const instance = typeof provider === 'function' ? new provider() : provider;
    this.providers.push(instance);
    return this;
  }

  /**
   * Register multiple providers
   */
  registerMany(providers: (Provider | (new () => Provider))[]): this {
    for (const provider of providers) {
      this.register(provider);
    }
    return this;
  }

  /**
   * Boot all registered providers
   */
  async boot(): Promise<void> {
    if (this.booted) return;

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
  isBooted(): boolean {
    return this.booted;
  }
}

// ============================================
// Deferred Provider (for lazy loading)
// ============================================

export abstract class DeferredServiceProvider extends ServiceProvider {
  /**
   * Services that this provider provides
   * Used for deferred loading
   */
  abstract provides(): string[];
}

// ============================================
// Singleton Kernel
// ============================================

let kernelInstance: ApplicationKernel | null = null;

export function kernel(): ApplicationKernel {
  if (!kernelInstance) {
    kernelInstance = new ApplicationKernel();
  }
  return kernelInstance;
}

export function initKernel(): ApplicationKernel {
  kernelInstance = new ApplicationKernel();
  return kernelInstance;
}

export default ServiceProvider;
