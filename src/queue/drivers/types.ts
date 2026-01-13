export interface Job {
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

export interface QueueConfig {
  default?: string;
  connections?: {
    sync?: { driver: 'sync' };
    database?: { driver: 'database'; table?: string };
    redis?: { driver: 'redis'; host?: string; port?: number; password?: string };
  };
  concurrency?: number; // Worker concurrency
}

export interface QueueDriver {
  push(job: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string>;
  later(delay: number, job: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string>;
  
  // Worker methods
  pop(): Promise<Job | null>;
  complete(job: Job): Promise<void>;
  fail(job: Job, error: Error): Promise<void>;
  release(job: Job, delay: number): Promise<void>; // Retry
  
  // Maintenance & Stats
  clear(): Promise<void>;
  size(): Promise<number>;
  
  // Dashboard Support
  getFailed(offset?: number, limit?: number): Promise<Job[]>;
  getPending(offset?: number, limit?: number): Promise<Job[]>;
  getStats(): Promise<{ pending: number; failed: number; processed: number }>;
  retry(jobId: string): Promise<void>;
  remove(jobId: string): Promise<void>;
}
