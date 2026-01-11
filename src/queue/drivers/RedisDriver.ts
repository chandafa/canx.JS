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
}

export class RedisDriver implements QueueDriver {
  private client: RedisClient;
  private queueKey: string;
  private delayedKey: string;

  constructor(client: any, prefix: string = 'canx_queue') {
    this.client = client;
    this.queueKey = `${prefix}:pending`;
    this.delayedKey = `${prefix}:delayed`;
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
    // In Redis list pattern, popping removes it.
    // For reliability, we might use RPOPLPUSH to a 'processing' list, but keeping it simple for now.
    // No action needed for simple model.
  }

  async fail(job: Job, error: Error): Promise<void> {
    // Log failure or move to failed queue
    // For now, we assume it's dropped from main queue
  }

  async release(job: Job, delay: number): Promise<void> {
    job.status = 'pending';
    job.attempts++;
    await this.client.zadd(this.delayedKey, Date.now() + delay, JSON.stringify(job));
  }

  async clear(): Promise<void> {
    await this.client.del(this.queueKey);
    await this.client.del(this.delayedKey);
  }

  async size(): Promise<number> {
    const len = await this.client.llen(this.queueKey);
    const delayed = await this.client.zcard(this.delayedKey);
    return len + delayed;
  }
}
