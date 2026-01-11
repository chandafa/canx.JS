import type { QueueDriver, Job } from './types';

export class MemoryDriver implements QueueDriver {
  private jobs: Map<string, Job> = new Map();
  private pending: string[] = []; // Queue of IDs
  private delayed: { id: string; runAt: number }[] = [];

  async push(payload: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string> {
    const id = Math.random().toString(36).substring(7);
    const job: Job = {
      ...payload,
      id,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    };
    
    this.jobs.set(id, job);
    this.pending.push(id);
    return id;
  }

  async later(delay: number, payload: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string> {
    const id = Math.random().toString(36).substring(7);
    const job: Job = {
      ...payload,
      id,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    };

    this.jobs.set(id, job);
    this.delayed.push({ id, runAt: Date.now() + delay });
    return id;
  }

  async pop(): Promise<Job | null> {
    // Check delayed jobs
    const now = Date.now();
    const ready = this.delayed.filter(d => d.runAt <= now);
    
    for (const d of ready) {
      this.pending.push(d.id);
      this.delayed = this.delayed.filter(x => x.id !== d.id);
    }

    const id = this.pending.shift();
    if (!id) return null;

    const job = this.jobs.get(id);
    if (!job) return null;

    job.status = 'processing';
    return job;
  }

  async complete(job: Job): Promise<void> {
    const existing = this.jobs.get(job.id);
    if (existing) {
        existing.status = 'completed';
    }
  }

  async fail(job: Job, error: Error): Promise<void> {
    const existing = this.jobs.get(job.id);
    if (existing) {
        existing.status = 'failed';
        existing.error = error.message;
    }
  }

  async release(job: Job, delay: number): Promise<void> {
      const existing = this.jobs.get(job.id);
      if (existing) {
          existing.status = 'pending';
          existing.attempts++;
          this.delayed.push({ id: job.id, runAt: Date.now() + delay });
      }
  }

  async clear(): Promise<void> {
    this.jobs.clear();
    this.pending = [];
    this.delayed = [];
  }

  async size(): Promise<number> {
    return this.pending.length + this.delayed.length;
  }
}
