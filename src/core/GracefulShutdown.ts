/**
 * CanxJS Graceful Shutdown - Zero-downtime shutdown management
 * @description Handles graceful server shutdown with connection draining
 */

export interface GracefulShutdownConfig {
  /** Grace period for shutdown in ms */
  timeout?: number;
  /** Signals to listen for */
  signals?: NodeJS.Signals[];
  /** Force exit after timeout */
  forceExit?: boolean;
  /** Log shutdown progress */
  logging?: boolean;
}

type ShutdownHook = () => Promise<void> | void;

interface ShutdownState {
  isShuttingDown: boolean;
  startTime?: Date;
  hooks: { name: string; hook: ShutdownHook; priority: number }[];
}

/**
 * Graceful Shutdown Manager
 */
export class GracefulShutdown {
  private config: Required<GracefulShutdownConfig>;
  private state: ShutdownState = {
    isShuttingDown: false,
    hooks: [],
  };
  private initCompletePromise: Promise<void>;
  private initCompleteResolver!: () => void;

  constructor(config: GracefulShutdownConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000,
      signals: config.signals ?? ['SIGTERM', 'SIGINT'],
      forceExit: config.forceExit ?? true,
      logging: config.logging ?? true,
    };

    this.initCompletePromise = new Promise((resolve) => {
      this.initCompleteResolver = resolve;
    });
  }

  /**
   * Check if shutdown is in progress
   */
  get isShuttingDown(): boolean {
    return this.state.isShuttingDown;
  }

  /**
   * Register a shutdown hook
   * @param name - Name of the hook for logging
   * @param hook - Async function to run during shutdown
   * @param priority - Higher priority runs first (default: 0)
   */
  register(name: string, hook: ShutdownHook, priority: number = 0): this {
    this.state.hooks.push({ name, hook, priority });
    // Sort by priority (higher first)
    this.state.hooks.sort((a, b) => b.priority - a.priority);
    return this;
  }

  /**
   * Register server for graceful shutdown
   */
  registerServer(server: { close: () => Promise<void> | void }, name: string = 'HTTP Server'): this {
    return this.register(name, async () => {
      await server.close();
    }, 100); // High priority - close server first
  }

  /**
   * Register database connection
   */
  registerDatabase(db: { close: () => Promise<void> | void }, name: string = 'Database'): this {
    return this.register(name, async () => {
      await db.close();
    }, 50); // Medium priority
  }

  /**
   * Register cache connection
   */
  registerCache(cache: { disconnect?: () => Promise<void> | void; close?: () => Promise<void> | void }, name: string = 'Cache'): this {
    return this.register(name, async () => {
      if (cache.disconnect) await cache.disconnect();
      else if (cache.close) await cache.close();
    }, 40);
  }

  /**
   * Register queue connection
   */
  registerQueue(queue: { close: () => Promise<void> | void }, name: string = 'Queue'): this {
    return this.register(name, async () => {
      await queue.close();
    }, 30);
  }

  /**
   * Start listening for shutdown signals
   */
  listen(): this {
    for (const signal of this.config.signals) {
      process.on(signal, () => {
        this.shutdown(signal);
      });
    }

    // Mark initialization complete
    this.initCompleteResolver();
    
    if (this.config.logging) {
      console.log(`[Shutdown] Listening for signals: ${this.config.signals.join(', ')}`);
    }
    
    return this;
  }

  /**
   * Wait for initialization to complete
   */
  async ready(): Promise<void> {
    await this.initCompletePromise;
  }

  /**
   * Trigger shutdown manually
   */
  async shutdown(signal?: string): Promise<void> {
    if (this.state.isShuttingDown) {
      console.log('[Shutdown] Already in progress, ignoring...');
      return;
    }

    this.state.isShuttingDown = true;
    this.state.startTime = new Date();

    if (this.config.logging) {
      console.log(`\n[Shutdown] ${signal ? `Received ${signal}, ` : ''}initiating graceful shutdown...`);
      console.log(`[Shutdown] Grace period: ${this.config.timeout}ms`);
      console.log(`[Shutdown] Hooks to run: ${this.state.hooks.length}`);
    }

    // Set force kill timer
    let forceKillTimer: Timer | null = null;
    if (this.config.forceExit) {
      forceKillTimer = setTimeout(() => {
        console.error('[Shutdown] Grace period exceeded, forcing exit...');
        process.exit(1);
      }, this.config.timeout);
    }

    try {
      // Run all hooks
      for (const { name, hook } of this.state.hooks) {
        const start = Date.now();
        try {
          if (this.config.logging) {
            console.log(`[Shutdown] Running: ${name}...`);
          }
          await hook();
          if (this.config.logging) {
            console.log(`[Shutdown] ✓ ${name} (${Date.now() - start}ms)`);
          }
        } catch (error) {
          console.error(`[Shutdown] ✗ ${name} failed:`, error);
        }
      }

      // Clear force kill timer
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
      }

      const duration = Date.now() - this.state.startTime.getTime();
      if (this.config.logging) {
        console.log(`[Shutdown] Complete in ${duration}ms`);
      }

      if (this.config.forceExit) {
        process.exit(0);
      }
    } catch (error) {
      console.error('[Shutdown] Error during shutdown:', error);
      if (this.config.forceExit) {
        process.exit(1);
      }
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

let shutdownInstance: GracefulShutdown | null = null;

/**
 * Initialize graceful shutdown
 */
export function initGracefulShutdown(config?: GracefulShutdownConfig): GracefulShutdown {
  if (!shutdownInstance) {
    shutdownInstance = new GracefulShutdown(config);
  }
  return shutdownInstance;
}

/**
 * Get graceful shutdown instance
 */
export function gracefulShutdown(): GracefulShutdown {
  if (!shutdownInstance) {
    shutdownInstance = new GracefulShutdown();
  }
  return shutdownInstance;
}

/**
 * Quick setup for graceful shutdown
 */
export function setupGracefulShutdown(options?: GracefulShutdownConfig): GracefulShutdown {
  const instance = initGracefulShutdown(options);
  instance.listen();
  return instance;
}

export default GracefulShutdown;
