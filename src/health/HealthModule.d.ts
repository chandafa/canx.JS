/**
 * CanxJS Health Check Module
 * Inspired by @nestjs/terminus
 */
export type HealthCheckStatus = 'up' | 'down';
export interface HealthIndicatorResult {
    [key: string]: {
        status: HealthCheckStatus;
        [key: string]: any;
    };
}
export interface HealthCheckResult {
    status: 'ok' | 'error' | 'shutting_down';
    info?: HealthIndicatorResult;
    error?: HealthIndicatorResult;
    details: HealthIndicatorResult;
}
export declare class HealthCheckError extends Error {
    message: string;
    causes: any;
    constructor(message: string, causes: any);
}
export declare abstract class HealthIndicator {
    protected getStatus(key: string, isHealthy: boolean, data?: {
        [key: string]: any;
    }): HealthIndicatorResult;
}
/**
 * Check Database Connection Health
 */
export declare class DatabaseHealthIndicator extends HealthIndicator {
    pingCheck(key: string, options?: {
        timeout?: number;
    }): Promise<HealthIndicatorResult>;
}
/**
 * Check Memory Usage
 */
export declare class MemoryHealthIndicator extends HealthIndicator {
    checkHeap(key: string, thresholdInBytes: number): Promise<HealthIndicatorResult>;
    checkRSS(key: string, thresholdInBytes: number): Promise<HealthIndicatorResult>;
}
/**
 * Check Disk Storage (requires 'check-disk-space' or similar in real world, using stub/fs logic here)
 * For basic implementation without deps, we might skip full disk check or use `fs` stats if possible.
 * But `fs` doesn't give free space easily in Node without executing `df`.
 * We'll check readability of a path instead for now.
 */
export declare class DiskHealthIndicator extends HealthIndicator {
    checkStorage(key: string, options: {
        path: string;
        thresholdPercent?: number;
    }): Promise<HealthIndicatorResult>;
}
export declare class HealthCheckService {
    check(checks: (() => Promise<HealthIndicatorResult>)[]): Promise<HealthCheckResult>;
}
export declare class HealthModule {
}
