/**
 * CanxJS Cluster Manager - Multi-process clustering for enterprise scaling
 * @description Enables horizontal scaling across all CPU cores
 */

import os from 'os';

export interface ClusterConfig {
  /** Enable cluster mode */
  enabled?: boolean;
  /** Number of workers (default: CPU cores) */
  workers?: number | 'auto';
  /** Restart workers on crash */
  restartOnCrash?: boolean;
  /** Max restarts before giving up */
  maxRestarts?: number;
  /** Restart delay in ms */
  restartDelay?: number;
  /** Grace period for shutdown in ms */
  gracePeriod?: number;
  /** Enable sticky sessions (for WebSocket) */
  stickySessions?: boolean;
}

interface WorkerInfo {
  id: number;
  pid: number;
  status: 'starting' | 'running' | 'stopping' | 'dead';
  restarts: number;
  startedAt: Date;
  lastHeartbeat?: Date;
}

type MessageHandler = (message: WorkerMessage) => void;

interface WorkerMessage {
  type: 'ready' | 'heartbeat' | 'shutdown' | 'metrics' | 'custom';
  workerId?: number;
  data?: unknown;
}

/**
 * Cluster Manager for CanxJS
 * Manages worker processes for horizontal scaling
 */
export class ClusterManager {
  private config: Required<ClusterConfig>;
  private workers: Map<number, WorkerInfo> = new Map();
  private isShuttingDown = false;
  private messageHandlers: MessageHandler[] = [];
  private workerProcesses: Map<number, any> = new Map(); // Bun.spawn processes
  private masterStartTime: Date = new Date();

  constructor(config: ClusterConfig = {}) {
    const cpuCount = os.cpus().length;
    
    this.config = {
      enabled: config.enabled ?? false,
      workers: config.workers === 'auto' ? cpuCount : (config.workers ?? cpuCount),
      restartOnCrash: config.restartOnCrash ?? true,
      maxRestarts: config.maxRestarts ?? 3,
      restartDelay: config.restartDelay ?? 1000,
      gracePeriod: config.gracePeriod ?? 30000,
      stickySessions: config.stickySessions ?? false,
    };
  }

  /**
   * Check if running as primary/master process
   */
  get isPrimary(): boolean {
    return !process.env.CANX_WORKER_ID;
  }

  /**
   * Check if running as worker process
   */
  get isWorker(): boolean {
    return !!process.env.CANX_WORKER_ID;
  }

  /**
   * Get current worker ID (if worker)
   */
  get workerId(): number | null {
    const id = process.env.CANX_WORKER_ID;
    return id ? parseInt(id, 10) : null;
  }

  /**
   * Get number of configured workers
   */
  get workerCount(): number {
    return this.config.workers as number;
  }

  /**
   * Start cluster with given app function
   */
  async start(appFn: () => Promise<void> | void): Promise<void> {
    if (!this.config.enabled) {
      // Single process mode
      await appFn();
      return;
    }

    if (this.isPrimary) {
      await this.startPrimary();
    } else {
      await this.startWorker(appFn);
    }
  }

  /**
   * Start primary/master process
   */
  private async startPrimary(): Promise<void> {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 CanxJS Cluster Mode                                 ║
║                                                          ║
║   → Workers:  ${String(this.config.workers).padEnd(4)} processes                            ║
║   → CPUs:     ${String(os.cpus().length).padEnd(4)} available                             ║
║   → Mode:     ${process.env.NODE_ENV === 'production' ? 'production ' : 'development'}                              ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);

    // Spawn workers
    for (let i = 1; i <= (this.config.workers as number); i++) {
      await this.spawnWorker(i);
    }

    // Setup signal handlers
    this.setupSignalHandlers();

    // Keep primary alive
    await this.runPrimaryLoop();
  }

  /**
   * Spawn a new worker process
   */
  private async spawnWorker(id: number): Promise<void> {
    const existingInfo = this.workers.get(id);
    const restarts = existingInfo?.restarts ?? 0;

    if (restarts >= this.config.maxRestarts) {
      console.error(`[Cluster] Worker ${id} exceeded max restarts (${this.config.maxRestarts}), not restarting`);
      return;
    }

    // Get the entry file
    const entryFile = process.argv[1];
    
    const workerEnv = {
      ...process.env,
      CANX_WORKER_ID: String(id),
      CANX_CLUSTER_MODE: '1',
    };

    try {
      const proc = Bun.spawn(['bun', entryFile], {
        env: workerEnv,
        stdio: ['inherit', 'inherit', 'inherit'],
        onExit: (proc, exitCode, signalCode) => {
          this.handleWorkerExit(id, exitCode, signalCode != null ? String(signalCode) : null);
        },
      });

      this.workerProcesses.set(id, proc);
      this.workers.set(id, {
        id,
        pid: proc.pid,
        status: 'starting',
        restarts: restarts,
        startedAt: new Date(),
      });

      console.log(`[Cluster] Worker ${id} started (PID: ${proc.pid})`);
    } catch (error) {
      console.error(`[Cluster] Failed to spawn worker ${id}:`, error);
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(id: number, exitCode: number | null, signal: string | null): void {
    const worker = this.workers.get(id);
    if (!worker) return;

    worker.status = 'dead';
    console.log(`[Cluster] Worker ${id} exited (code: ${exitCode}, signal: ${signal})`);

    if (this.isShuttingDown) {
      return;
    }

    if (this.config.restartOnCrash && worker.restarts < this.config.maxRestarts) {
      worker.restarts++;
      console.log(`[Cluster] Restarting worker ${id} (attempt ${worker.restarts}/${this.config.maxRestarts})`);
      
      setTimeout(() => {
        this.spawnWorker(id);
      }, this.config.restartDelay);
    }
  }

  /**
   * Start worker process
   */
  private async startWorker(appFn: () => Promise<void> | void): Promise<void> {
    const workerId = this.workerId;
    console.log(`[Worker ${workerId}] Starting...`);

    // Run the app
    await appFn();

    // Mark as ready
    console.log(`[Worker ${workerId}] Ready`);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log(`\n[Cluster] Received ${signal}, initiating graceful shutdown...`);

      // Send shutdown signal to all workers
      for (const [id, proc] of this.workerProcesses) {
        const worker = this.workers.get(id);
        if (worker && worker.status === 'running') {
          worker.status = 'stopping';
          proc.kill('SIGTERM');
        }
      }

      // Wait for grace period
      const deadline = Date.now() + this.config.gracePeriod;
      while (Date.now() < deadline) {
        const allStopped = Array.from(this.workers.values()).every(
          w => w.status === 'dead' || w.status === 'stopping'
        );
        if (allStopped) break;
        await Bun.sleep(100);
      }

      // Force kill remaining workers
      for (const [id, proc] of this.workerProcesses) {
        const worker = this.workers.get(id);
        if (worker && worker.status !== 'dead') {
          console.log(`[Cluster] Force killing worker ${id}`);
          proc.kill('SIGKILL');
        }
      }

      console.log('[Cluster] Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Primary process main loop
   */
  private async runPrimaryLoop(): Promise<void> {
    while (!this.isShuttingDown) {
      // Health check workers
      for (const [id, worker] of this.workers) {
        if (worker.status === 'starting') {
          // Check if process exists
          const proc = this.workerProcesses.get(id);
          if (proc && !proc.killed) {
            worker.status = 'running';
          }
        }
      }

      await Bun.sleep(5000);
    }
  }

  /**
   * Get cluster status
   */
  getStatus(): {
    isPrimary: boolean;
    uptime: number;
    workers: WorkerInfo[];
    totalRestarts: number;
  } {
    const workers = Array.from(this.workers.values());
    return {
      isPrimary: this.isPrimary,
      uptime: Date.now() - this.masterStartTime.getTime(),
      workers,
      totalRestarts: workers.reduce((sum, w) => sum + w.restarts, 0),
    };
  }

  /**
   * Register message handler
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Broadcast message to all workers
   */
  broadcast(message: WorkerMessage): void {
    // In Bun, we'd use IPC or shared memory
    // For now, we'll use process signaling
    for (const proc of this.workerProcesses.values()) {
      // proc.send is not available in Bun yet
      // This is a placeholder for future IPC support
    }
  }
}

/**
 * Singleton cluster manager instance
 */
let clusterInstance: ClusterManager | null = null;

/**
 * Initialize cluster mode
 */
export function initCluster(config?: ClusterConfig): ClusterManager {
  if (!clusterInstance) {
    clusterInstance = new ClusterManager(config);
  }
  return clusterInstance;
}

/**
 * Get cluster manager instance
 */
export function cluster(): ClusterManager {
  if (!clusterInstance) {
    clusterInstance = new ClusterManager();
  }
  return clusterInstance;
}

/**
 * Cluster mode decorator/wrapper
 */
export async function withCluster(
  config: ClusterConfig,
  appFn: () => Promise<void> | void
): Promise<void> {
  const manager = initCluster(config);
  await manager.start(appFn);
}

export default ClusterManager;
