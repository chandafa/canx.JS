/**
 * CanxJS Health Checks - Application health monitoring
 */
import type { CanxRequest, CanxResponse } from '../types';
export type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';
export interface HealthCheckResult {
    name: string;
    status: HealthStatus;
    message?: string;
    responseTime?: number;
    details?: Record<string, unknown>;
}
export interface HealthReport {
    status: HealthStatus;
    timestamp: string;
    uptime: number;
    version?: string;
    checks: HealthCheckResult[];
}
export type HealthChecker = () => Promise<HealthCheckResult>;
/**
 * Database health check
 */
export declare function databaseCheck(name?: string): HealthChecker;
/**
 * Memory usage check
 */
export declare function memoryCheck(thresholdMB?: number): HealthChecker;
/**
 * Disk space check
 */
export declare function diskCheck(path?: string, thresholdGB?: number): HealthChecker;
/**
 * External service check (HTTP endpoint)
 */
export declare function httpCheck(name: string, url: string, timeoutMs?: number): HealthChecker;
/**
 * Redis health check
 */
export declare function redisCheck(name?: string): HealthChecker;
/**
 * Custom check
 */
export declare function customCheck(name: string, checker: () => Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, unknown>;
}>): HealthChecker;
declare class HealthCheckManager {
    private checks;
    private startTime;
    private version?;
    /**
     * Set application version
     */
    setVersion(version: string): this;
    /**
     * Register a health check
     */
    register(name: string, checker: HealthChecker): this;
    /**
     * Remove a health check
     */
    unregister(name: string): this;
    /**
     * Run all health checks
     */
    check(): Promise<HealthReport>;
    /**
     * Simple liveness check (just returns ok)
     */
    liveness(): {
        status: 'ok';
        timestamp: string;
    };
    /**
     * Readiness check (checks if app can serve traffic)
     */
    readiness(): Promise<HealthReport>;
    /**
     * Get uptime in seconds
     */
    getUptime(): number;
}
export declare function healthRoutes(health: HealthCheckManager): (req: CanxRequest, res: CanxResponse) => Response | Promise<Response>;
declare class MetricsRegistry {
    private counters;
    private gauges;
    private histograms;
    counter(name: string, value?: number, labels?: Record<string, string>): void;
    gauge(name: string, value: number, labels?: Record<string, string>): void;
    histogram(name: string, value: number): void;
    toPrometheus(): string;
    private formatLabels;
}
export declare const health: HealthCheckManager;
export declare const metrics: MetricsRegistry;
export declare function createHealthManager(): HealthCheckManager;
declare const _default: {
    health: HealthCheckManager;
    metrics: MetricsRegistry;
    databaseCheck: typeof databaseCheck;
    memoryCheck: typeof memoryCheck;
    diskCheck: typeof diskCheck;
    httpCheck: typeof httpCheck;
    redisCheck: typeof redisCheck;
    customCheck: typeof customCheck;
    healthRoutes: typeof healthRoutes;
};
export default _default;
