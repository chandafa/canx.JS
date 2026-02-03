import type { QueueConfig, QueueDriver, Job } from './drivers/types';
import { MemoryDriver } from './drivers/MemoryDriver';

export class Queue {
  public driver: QueueDriver;
  private config: QueueConfig;
  private running: boolean = false;
  private processing: boolean = false;
  private handlers: Map<string, (data: any) => Promise<void>> = new Map();
  private timer: Timer | null = null;
  private concurrency: number;

  constructor(config: QueueConfig = {}) {
    this.config = config;
    this.concurrency = config.concurrency || 5;

    // Default to Memory Driver
    if (config.connections?.redis && config.default === 'redis') {
      // Allow dynamic injection of Redis client or driver
      // For now, we default to memory if no driver instance provided externally
      // In a real app, we would load RedisDriver here
      console.warn('[Queue] Redis driver requires manual setup or injection. Defaulting to Memory.');
      this.driver = (config as any).driverInstance || new MemoryDriver();
    } else {
      this.driver = new MemoryDriver();
    }
  }

  /**
   * Use a specific driver instance
   */
  use(driver: QueueDriver): this {
    this.driver = driver;
    return this;
  }

  /**
   * Define a job handler
   */
  define(name: string, handler: (data: any) => Promise<void>): void {
    this.handlers.set(name, handler);
  }

  /**
   * Dispatch a job immediately
   */
  async dispatch(name: string, data: unknown = {}, options: { delay?: number; queue?: string } = {}): Promise<string> {
    const delay = options.delay || 0;
    return this.driver.push({ name, data, delay, maxAttempts: 3, scheduledAt: Date.now() + delay });
  }

  /**
   * Schedule a job to run later
   */
  async schedule(name: string, data: unknown, delay: number | string): Promise<string> {
    const delayMs = typeof delay === 'string' ? this.parseDelay(delay) : delay;
    return this.driver.push({ name, data, delay: delayMs, maxAttempts: 3, scheduledAt: Date.now() + delayMs });
  }

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[Queue] Worker started');
    this.process();
  }

  /**
   * Stop processing jobs
   */
  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    console.log('[Queue] Worker stopped');
  }

  private async process() {
    if (!this.running) return;

    if (this.processing) {
       this.timer = setTimeout(() => this.process(), 100);
       return;
    }

    this.processing = true;
    try {
      const job = await this.driver.pop();
      if (job) {
        await this.handleJob(job);
        // If we found a job, try to get another one immediately
        this.processing = false;
        setImmediate(() => this.process());
        return;
      }
    } catch (e) {
      console.error('[Queue] Error processing job:', e);
    } finally {
      this.processing = false;
    }

    // No job found, wait a bit
    this.timer = setTimeout(() => this.process(), 1000);
  }

  private async handleJob(job: Job) {
    const handler = this.handlers.get(job.name);
    if (!handler) {
      console.error(`[Queue] No handler for ${job.name}`);
      await this.driver.fail(job, new Error('No handler'));
      return;
    }

    try {
      await handler(job.data);
      await this.driver.complete(job);
    } catch (e) {
      console.error(`[Queue] Failed ${job.name}:`, e);
      if (job.attempts < job.maxAttempts) {
        // Retry logic usually depends on driver, but here we explicitly release
        await this.driver.release(job, 5000 * (job.attempts + 1)); 
      } else {
        await this.driver.fail(job, e as Error);
      }
    }
  }

  /**
   * Stats and maintenance
   */
  async getStats() {
    return this.driver.getStats();
  }

  async getFailed(offset?: number, limit?: number) {
    return this.driver.getFailed(offset, limit);
  }

  async getPending(offset?: number, limit?: number) {
    return this.driver.getPending(offset, limit);
  }

  async retry(jobId: string) {
    return this.driver.retry(jobId);
  }

  async clear() {
    return this.driver.clear();
  }



  private parseDelay(delay: string): number {
    const match = delay.match(/^(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hour|hours|d|day|days)$/i);
    if (!match) return 0;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 's': case 'sec': return value * 1000;
      case 'm': case 'min': return value * 60 * 1000;
      case 'h': case 'hour': return value * 60 * 60 * 1000;
      case 'd': case 'day': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }
}

export const queue = new Queue();
export function createQueue(config?: QueueConfig) { return new Queue(config); }
export { QueueConfig, QueueDriver, Job };
export { MemoryDriver } from './drivers/MemoryDriver';
export { RedisDriver } from './drivers/RedisDriver';
