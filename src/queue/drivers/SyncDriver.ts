import type { QueueDriver, Job } from './types';

/**
 * Executor callback that actually runs a job's work. The Queue wires this to its
 * registered handler map so a sync-driven job can be resolved by name and invoked
 * inline. If no executor is supplied the driver still behaves correctly — the job
 * is simply marked completed without work being run.
 */
export type SyncExecutor = (job: Job) => void | Promise<void>;

/**
 * SyncDriver runs every dispatched job IMMEDIATELY (inline) instead of queueing it.
 * There is therefore never anything to pop() and size() is always 0 — the work is
 * already done by the time push()/later() resolves. Mirrors Laravel's `sync` driver.
 */
export class SyncDriver implements QueueDriver {
  private executor?: SyncExecutor;
  private completed: Job[] = [];
  private failed: Job[] = [];
  private processedCount = 0;

  constructor(executor?: SyncExecutor) {
    this.executor = executor;
  }

  private makeJob(payload: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Job {
    return {
      ...payload,
      id: Math.random().toString(36).substring(7),
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    };
  }

  private async run(job: Job): Promise<void> {
    if (!this.executor) {
      // No handler resolver wired: record as processed without running work.
      job.status = 'completed';
      this.completed.push(job);
      this.processedCount++;
      return;
    }

    job.status = 'processing';
    try {
      await this.executor(job);
      job.status = 'completed';
      this.completed.push(job);
      this.processedCount++;
    } catch (e) {
      job.status = 'failed';
      job.error = (e as Error).message;
      this.failed.push(job);
      console.error(`[Queue:sync] Failed ${job.name}:`, e);
    }
  }

  async push(payload: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string> {
    const job = this.makeJob(payload);
    await this.run(job);
    return job.id;
  }

  async later(_delay: number, payload: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string> {
    // Sync execution ignores the delay and runs immediately.
    const job = this.makeJob(payload);
    await this.run(job);
    return job.id;
  }

  // Worker methods — nothing is ever queued, so there is nothing to pop or process.
  async pop(): Promise<Job | null> {
    return null;
  }

  async complete(job: Job): Promise<void> {
    job.status = 'completed';
  }

  async fail(job: Job, error: Error): Promise<void> {
    job.status = 'failed';
    job.error = error.message;
    this.failed.push(job);
  }

  async release(_job: Job, _delay: number): Promise<void> {
    // No queue to release back into for a synchronous driver.
  }

  async clear(): Promise<void> {
    this.completed = [];
    this.failed = [];
    this.processedCount = 0;
  }

  async size(): Promise<number> {
    return 0;
  }

  // Dashboard support
  async getFailed(offset: number = 0, limit: number = 20): Promise<Job[]> {
    return this.failed
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(offset, offset + limit);
  }

  async getPending(_offset: number = 0, _limit: number = 20): Promise<Job[]> {
    // Nothing is ever pending with a synchronous driver.
    return [];
  }

  async getStats(): Promise<{ pending: number; failed: number; processed: number }> {
    return { pending: 0, failed: this.failed.length, processed: this.processedCount };
  }

  async retry(jobId: string): Promise<void> {
    const idx = this.failed.findIndex(j => j.id === jobId);
    if (idx === -1) return;
    const [job] = this.failed.splice(idx, 1);
    job.status = 'pending';
    job.error = undefined;
    job.createdAt = Date.now();
    await this.run(job);
  }

  async remove(jobId: string): Promise<void> {
    this.failed = this.failed.filter(j => j.id !== jobId);
    this.completed = this.completed.filter(j => j.id !== jobId);
  }
}
