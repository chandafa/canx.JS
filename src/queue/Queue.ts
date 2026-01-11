/**
 * CanxJS Queue - Built-in Task Queue / Job System
 */

type JobHandler = (data: unknown) => Promise<void> | void;

interface Job {
  id: string;
  name: string;
  data: unknown;
  attempts: number;
  maxAttempts: number;
  delay: number;
  scheduledAt: number;
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

interface QueueConfig {
  concurrency?: number;
  retryDelay?: number;
  maxRetries?: number;
}

class Queue {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<string, JobHandler> = new Map();
  private processing: Set<string> = new Set();
  private config: QueueConfig;
  private running: boolean = false;
  private timer: Timer | null = null;

  constructor(config: QueueConfig = {}) {
    this.config = {
      concurrency: 5,
      retryDelay: 5000,
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * Define a job handler
   */
  define(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  /**
   * Dispatch a job immediately
   */
  dispatch(name: string, data: unknown = {}): string {
    return this.addJob(name, data, 0);
  }

  /**
   * Schedule a job to run later
   */
  schedule(name: string, data: unknown, delay: string | number): string {
    const delayMs = typeof delay === 'string' ? this.parseDelay(delay) : delay;
    return this.addJob(name, data, delayMs);
  }

  /**
   * Schedule a job to run at a specific time
   */
  scheduleAt(name: string, data: unknown, date: Date): string {
    const delayMs = date.getTime() - Date.now();
    return this.addJob(name, data, Math.max(0, delayMs));
  }

  private addJob(name: string, data: unknown, delay: number): string {
    const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    const job: Job = {
      id,
      name,
      data,
      attempts: 0,
      maxAttempts: this.config.maxRetries! + 1,
      delay,
      scheduledAt: Date.now() + delay,
      createdAt: Date.now(),
      status: 'pending',
    };
    this.jobs.set(id, job);
    return id;
  }

  private parseDelay(delay: string): number {
    const match = delay.match(/^(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hour|hours|d|day|days)$/i);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 's': case 'sec': case 'second': case 'seconds': return value * 1000;
      case 'm': case 'min': case 'minute': case 'minutes': return value * 60 * 1000;
      case 'h': case 'hour': case 'hours': return value * 60 * 60 * 1000;
      case 'd': case 'day': case 'days': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[Queue] Started processing jobs');
    this.tick();
  }

  /**
   * Stop processing jobs
   */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[Queue] Stopped processing jobs');
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    const now = Date.now();
    const pendingJobs = Array.from(this.jobs.values())
      .filter(j => j.status === 'pending' && j.scheduledAt <= now && !this.processing.has(j.id))
      .slice(0, this.config.concurrency! - this.processing.size);

    for (const job of pendingJobs) {
      this.processJob(job);
    }

    this.timer = setTimeout(() => this.tick(), 100);
  }

  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.name);
    if (!handler) {
      console.error(`[Queue] No handler for job: ${job.name}`);
      job.status = 'failed';
      job.error = 'No handler defined';
      return;
    }

    this.processing.add(job.id);
    job.status = 'processing';
    job.attempts++;

    try {
      await handler(job.data);
      job.status = 'completed';
      console.log(`[Queue] Completed: ${job.name} (${job.id})`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Queue] Failed: ${job.name} (${job.id}) - ${errMsg}`);

      if (job.attempts < job.maxAttempts) {
        job.status = 'pending';
        job.scheduledAt = Date.now() + this.config.retryDelay!;
        console.log(`[Queue] Retrying ${job.name} in ${this.config.retryDelay}ms (attempt ${job.attempts}/${job.maxAttempts})`);
      } else {
        job.status = 'failed';
        job.error = errMsg;
      }
    } finally {
      this.processing.delete(job.id);
    }
  }

  /**
   * Get job by ID
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get all jobs of a status
   */
  getJobs(status?: Job['status']): Job[] {
    const jobs = Array.from(this.jobs.values());
    return status ? jobs.filter(j => j.status === status) : jobs;
  }

  /**
   * Remove completed/failed jobs
   */
  prune(): number {
    let count = 0;
    for (const [id, job] of this.jobs) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobs.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Get queue statistics
   */
  stats(): { pending: number; processing: number; completed: number; failed: number } {
    const jobs = Array.from(this.jobs.values());
    return {
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    };
  }
}

// Singleton instance
export const queue = new Queue();

export function createQueue(config?: QueueConfig): Queue {
  return new Queue(config);
}

export default queue;
