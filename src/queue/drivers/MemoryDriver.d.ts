import type { QueueDriver, Job } from './types';
export declare class MemoryDriver implements QueueDriver {
    private jobs;
    private pending;
    private delayed;
    push(payload: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string>;
    later(delay: number, payload: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string>;
    pop(): Promise<Job | null>;
    complete(job: Job): Promise<void>;
    fail(job: Job, error: Error): Promise<void>;
    release(job: Job, delay: number): Promise<void>;
    clear(): Promise<void>;
    size(): Promise<number>;
    getFailed(offset?: number, limit?: number): Promise<Job[]>;
    getPending(offset?: number, limit?: number): Promise<Job[]>;
    getStats(): Promise<{
        pending: number;
        failed: number;
        processed: number;
    }>;
    retry(jobId: string): Promise<void>;
    remove(jobId: string): Promise<void>;
}
