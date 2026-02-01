import type { QueueConfig, QueueDriver, Job } from './drivers/types';
export declare class Queue {
    driver: QueueDriver;
    private config;
    private running;
    private processing;
    private handlers;
    private timer;
    private concurrency;
    constructor(config?: QueueConfig);
    /**
     * Use a specific driver instance
     */
    use(driver: QueueDriver): this;
    /**
     * Define a job handler
     */
    define(name: string, handler: (data: any) => Promise<void>): void;
    /**
     * Dispatch a job immediately
     */
    dispatch(name: string, data?: unknown): Promise<string>;
    /**
     * Schedule a job to run later
     */
    schedule(name: string, data: unknown, delay: number | string): Promise<string>;
    /**
     * Start processing jobs
     */
    start(): void;
    /**
     * Stop processing jobs
     */
    stop(): void;
    private process;
    private handleJob;
    /**
     * Stats and maintenance
     */
    getStats(): Promise<{
        pending: number;
        failed: number;
        processed: number;
    }>;
    getFailed(offset?: number, limit?: number): Promise<Job[]>;
    getPending(offset?: number, limit?: number): Promise<Job[]>;
    retry(jobId: string): Promise<void>;
    clear(): Promise<void>;
    private parseDelay;
}
export declare const queue: Queue;
export declare function createQueue(config?: QueueConfig): Queue;
export { QueueConfig, QueueDriver, Job };
export { MemoryDriver } from './drivers/MemoryDriver';
export { RedisDriver } from './drivers/RedisDriver';
