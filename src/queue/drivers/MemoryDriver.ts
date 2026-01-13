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

  // Dashboard Methods
  async getFailed(offset: number = 0, limit: number = 20): Promise<Job[]> {
    const failed = Array.from(this.jobs.values())
        .filter(job => job.status === 'failed')
        .sort((a, b) => b.createdAt - a.createdAt);
    return failed.slice(offset, offset + limit);
  }

  async getPending(offset: number = 0, limit: number = 20): Promise<Job[]> {
     const pending = Array.from(this.jobs.values())
        .filter(job => job.status === 'pending')
        .sort((a, b) => a.createdAt - b.createdAt);
     return pending.slice(offset, offset + limit);
  }

  async getStats(): Promise<{ pending: number; failed: number; processed: number }> {
     let pending = 0;
     let failed = 0;
     let processed = 0;
     for (const job of this.jobs.values()) {
         if (job.status === 'pending') pending++;
         if (job.status === 'failed') failed++;
         if (job.status === 'completed') processed++;
     }
     return { pending, failed, processed };
  }

  async retry(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'failed') return;
    
    // Reset to pending
    job.status = 'pending';
    job.error = undefined;
    job.createdAt = Date.now(); // Optional: reset time or keep original
    
    // Add back to pending queue
    this.pending.push(job.id);
  }

  async remove(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
    this.pending = this.pending.filter(id => id !== jobId);
    this.delayed = this.delayed.filter(d => d.id !== jobId);
  }
}
