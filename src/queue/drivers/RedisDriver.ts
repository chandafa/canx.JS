import type { QueueDriver, Job } from './types';

// Simple Redis commands interface to avoid heavy dependency
interface RedisClient {
  lpush(key: string, ...args: string[]): Promise<number>;
  rpop(key: string): Promise<string | null>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>;
  zrem(key: string, ...members: string[]): Promise<number>;
  del(key: string): Promise<number>;
  llen(key: string): Promise<number>;
  zcard(key: string): Promise<number>;
  // New commands for dashboard
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  lrem(key: string, count: number, element: string): Promise<number>;
  incr(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
}

export class RedisDriver implements QueueDriver {
  private client: RedisClient;
  private queueKey: string;
  private delayedKey: string;
  private failedKey: string;
  private processedKey: string;

  constructor(client: any, prefix: string = 'canx_queue') {
    this.client = client;
    this.queueKey = `${prefix}:pending`;
    this.delayedKey = `${prefix}:delayed`;
    this.failedKey = `${prefix}:failed`;
    this.processedKey = `${prefix}:processed`;
  }

  async push(payload: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string> {
    const id = Math.random().toString(36).substring(7);
    const job: Job = {
      ...payload,
      id,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    };
    
    // Store job in a list
    await this.client.lpush(this.queueKey, JSON.stringify(job));
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

    // Store in sorted set for delayed execution
    await this.client.zadd(this.delayedKey, Date.now() + delay, JSON.stringify(job));
    return id;
  }

  async pop(): Promise<Job | null> {
    // 1. Move delayed jobs to pending
    const now = Date.now();
    const ready = await this.client.zrangebyscore(this.delayedKey, 0, now);
    
    if (ready.length > 0) {
      for (const jobStr of ready) {
        await this.client.lpush(this.queueKey, jobStr);
        await this.client.zrem(this.delayedKey, jobStr);
      }
    }

    // 2. Pop from pending
    const jobStr = await this.client.rpop(this.queueKey);
    if (!jobStr) return null;

    try {
      const job = JSON.parse(jobStr);
      job.status = 'processing';
      return job;
    } catch (e) {
      return null;
    }
  }

  async complete(job: Job): Promise<void> {
    job.status = 'completed';
    await this.client.incr(this.processedKey);
  }

  async fail(job: Job, error: Error): Promise<void> {
    job.status = 'failed';
    job.error = error.message;
    await this.client.lpush(this.failedKey, JSON.stringify(job));
  }

  async release(job: Job, delay: number): Promise<void> {
    job.status = 'pending';
    job.attempts++;
    await this.client.zadd(this.delayedKey, Date.now() + delay, JSON.stringify(job));
  }

  async clear(): Promise<void> {
    await this.client.del(this.queueKey);
    await this.client.del(this.delayedKey);
    await this.client.del(this.failedKey);
    await this.client.del(this.processedKey);
  }

  async size(): Promise<number> {
    const len = await this.client.llen(this.queueKey);
    const delayed = await this.client.zcard(this.delayedKey);
    return len + delayed;
  }

  // Dashboard Methods
  async getFailed(offset: number = 0, limit: number = 20): Promise<Job[]> {
    const jobs = await this.client.lrange(this.failedKey, offset, offset + limit - 1);
    return jobs.map(j => JSON.parse(j));
  }

  async getPending(offset: number = 0, limit: number = 20): Promise<Job[]> {
     const jobs = await this.client.lrange(this.queueKey, offset, offset + limit - 1);
     return jobs.map(j => JSON.parse(j));
  }

  async getStats(): Promise<{ pending: number; failed: number; processed: number }> {
     const pending = await this.client.llen(this.queueKey);
     const delayed = await this.client.zcard(this.delayedKey);
     const failed = await this.client.llen(this.failedKey);
     
     const processedStr = await this.client.get(this.processedKey);
     const processed = processedStr ? parseInt(processedStr) : 0;

     return { pending: pending + delayed, failed, processed };
  }

  async retry(jobId: string): Promise<void> {
     // This is tricky in Redis without scanning. 
     // For now, we assume we fetch the job first using getFailed, then retry.
     // But wait, getFailed returns a list.
     // Optimization: We iterate through the failed list? No, that's slow.
     // For a 'lite' dashboard, we might just load the failed jobs in UI, and when user clicks retry,
     // we pass the FULL job object or just the ID. If just ID, we need to find it.
     // To keep it simple O(N) traversal of failed list is acceptable for now.
     
     const allFailed = await this.client.lrange(this.failedKey, 0, -1);
     for (const jobStr of allFailed) {
         const job = JSON.parse(jobStr);
         if (job.id === jobId) {
             // 1. Remove from failed
             await this.client.lrem(this.failedKey, 1, jobStr);
             // 2. Re-queue as pending
             job.status = 'pending';
             job.error = undefined;
             job.createdAt = Date.now();
             await this.client.lpush(this.queueKey, JSON.stringify(job));
             break;
         }
     }
  }

  async remove(jobId: string): Promise<void> {
    // Remove from pending?
    // This requires scanning lists which is expensive.
    // For failed jobs:
    const allFailed = await this.client.lrange(this.failedKey, 0, -1);
    for (const jobStr of allFailed) {
        if (jobStr.includes(jobId)) { // Quick check
             const job = JSON.parse(jobStr);
             if (job.id === jobId) {
                 await this.client.lrem(this.failedKey, 1, jobStr);
                 return;
             }
        }
    }
    
    // Also check pending... (omitted for performance unless requested)
  }
}
