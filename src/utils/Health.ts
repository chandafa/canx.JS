/**
 * CanxJS Health Checks - Application health monitoring
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';
import { query } from '../mvc/Model';

// ============================================
// Types
// ============================================

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

// ============================================
// Built-in Health Checks
// ============================================

/**
 * Database health check
 */
export function databaseCheck(name: string = 'database'): HealthChecker {
  return async () => {
    const start = performance.now();
    
    try {
      await query('SELECT 1');
      const responseTime = Math.round(performance.now() - start);
      
      return {
        name,
        status: 'healthy',
        message: 'Database connection successful',
        responseTime,
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: `Database connection failed: ${(error as Error).message}`,
        responseTime: Math.round(performance.now() - start),
      };
    }
  };
}

/**
 * Memory usage check
 */
export function memoryCheck(thresholdMB: number = 512): HealthChecker {
  return async () => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);

    const isHealthy = heapUsedMB < thresholdMB;
    const isDegraded = heapUsedMB >= thresholdMB * 0.8;

    return {
      name: 'memory',
      status: isHealthy ? (isDegraded ? 'degraded' : 'healthy') : 'unhealthy',
      message: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB, RSS: ${rssMB}MB`,
      details: {
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        rss: rssMB,
        threshold: thresholdMB,
      },
    };
  };
}

/**
 * Disk space check
 */
export function diskCheck(path: string = '.', thresholdGB: number = 1): HealthChecker {
  return async () => {
    try {
      // Use Bun's file system to check disk space
      const file = Bun.file(path);
      // Note: Bun doesn't expose disk space directly, this is a placeholder
      // In production, you'd use a system call or external package
      
      return {
        name: 'disk',
        status: 'healthy',
        message: `Disk check not fully implemented in Bun runtime`,
        details: { path, thresholdGB },
      };
    } catch (error) {
      return {
        name: 'disk',
        status: 'unhealthy',
        message: `Disk check failed: ${(error as Error).message}`,
      };
    }
  };
}

/**
 * External service check (HTTP endpoint)
 */
export function httpCheck(name: string, url: string, timeoutMs: number = 5000): HealthChecker {
  return async () => {
    const start = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      const responseTime = Math.round(performance.now() - start);

      if (response.ok) {
        return {
          name,
          status: 'healthy',
          message: `${url} responded with ${response.status}`,
          responseTime,
        };
      } else {
        return {
          name,
          status: 'degraded',
          message: `${url} responded with ${response.status}`,
          responseTime,
        };
      }
    } catch (error) {
      clearTimeout(timeout);
      return {
        name,
        status: 'unhealthy',
        message: `${url} - ${(error as Error).message}`,
        responseTime: Math.round(performance.now() - start),
      };
    }
  };
}

/**
 * Redis health check
 */
export function redisCheck(name: string = 'redis'): HealthChecker {
  return async () => {
    // Placeholder - would need Redis client integration
    return {
      name,
      status: 'healthy',
      message: 'Redis check not configured',
    };
  };
}

/**
 * Custom check
 */
export function customCheck(
  name: string,
  checker: () => Promise<{ healthy: boolean; message?: string; details?: Record<string, unknown> }>
): HealthChecker {
  return async () => {
    const start = performance.now();
    try {
      const result = await checker();
      return {
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        message: result.message,
        responseTime: Math.round(performance.now() - start),
        details: result.details,
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: (error as Error).message,
        responseTime: Math.round(performance.now() - start),
      };
    }
  };
}

// ============================================
// Health Check Manager
// ============================================

class HealthCheckManager {
  private checks: Map<string, HealthChecker> = new Map();
  private startTime: number = Date.now();
  private version?: string;

  /**
   * Set application version
   */
  setVersion(version: string): this {
    this.version = version;
    return this;
  }

  /**
   * Register a health check
   */
  register(name: string, checker: HealthChecker): this {
    this.checks.set(name, checker);
    return this;
  }

  /**
   * Remove a health check
   */
  unregister(name: string): this {
    this.checks.delete(name);
    return this;
  }

  /**
   * Run all health checks
   */
  async check(): Promise<HealthReport> {
    const results: HealthCheckResult[] = [];

    for (const [name, checker] of this.checks) {
      try {
        const result = await checker();
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          message: `Check failed: ${(error as Error).message}`,
        });
      }
    }

    // Determine overall status
    let status: HealthStatus = 'healthy';
    for (const result of results) {
      if (result.status === 'unhealthy') {
        status = 'unhealthy';
        break;
      }
      if (result.status === 'degraded') {
        status = 'degraded';
      }
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      version: this.version,
      checks: results,
    };
  }

  /**
   * Simple liveness check (just returns ok)
   */
  liveness(): { status: 'ok'; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check (checks if app can serve traffic)
   */
  async readiness(): Promise<HealthReport> {
    return this.check();
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.round((Date.now() - this.startTime) / 1000);
  }
}

// ============================================
// Health Routes
// ============================================

export function healthRoutes(health: HealthCheckManager): (req: CanxRequest, res: CanxResponse) => Response | Promise<Response> {
  return async (req, res) => {
    const path = req.path;

    // Liveness probe
    if (path.endsWith('/live') || path.endsWith('/liveness')) {
      return res.json(health.liveness());
    }

    // Readiness probe
    if (path.endsWith('/ready') || path.endsWith('/readiness')) {
      const report = await health.readiness();
      const status = report.status === 'healthy' ? 200 : 503;
      return res.status(status).json(report);
    }

    // Full health check
    const report = await health.check();
    const status = report.status === 'healthy' ? 200 : 
                   report.status === 'degraded' ? 200 : 503;
    return res.status(status).json(report);
  };
}

// ============================================
// Metrics (Prometheus-style)
// ============================================

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

class MetricsRegistry {
  private counters: Map<string, MetricValue[]> = new Map();
  private gauges: Map<string, MetricValue[]> = new Map();
  private histograms: Map<string, number[]> = new Map();

  counter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const existing = this.counters.get(name) || [];
    
    // Find matching labels
    const index = existing.findIndex(m => 
      JSON.stringify(m.labels || {}) === JSON.stringify(labels || {})
    );

    if (index >= 0) {
      existing[index].value += value;
    } else {
      existing.push({ value, labels });
    }

    this.counters.set(name, existing);
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const existing = this.gauges.get(name) || [];
    
    const index = existing.findIndex(m => 
      JSON.stringify(m.labels || {}) === JSON.stringify(labels || {})
    );

    if (index >= 0) {
      existing[index] = { value, labels };
    } else {
      existing.push({ value, labels });
    }

    this.gauges.set(name, existing);
  }

  histogram(name: string, value: number): void {
    const existing = this.histograms.get(name) || [];
    existing.push(value);
    this.histograms.set(name, existing);
  }

  toPrometheus(): string {
    const lines: string[] = [];

    // Output counters
    for (const [name, values] of this.counters) {
      lines.push(`# TYPE ${name} counter`);
      for (const { value, labels } of values) {
        const labelStr = this.formatLabels(labels);
        lines.push(`${name}${labelStr} ${value}`);
      }
    }

    // Output gauges
    for (const [name, values] of this.gauges) {
      lines.push(`# TYPE ${name} gauge`);
      for (const { value, labels } of values) {
        const labelStr = this.formatLabels(labels);
        lines.push(`${name}${labelStr} ${value}`);
      }
    }

    // Output histograms (simplified)
    for (const [name, values] of this.histograms) {
      if (values.length === 0) continue;
      
      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      
      lines.push(`# TYPE ${name} histogram`);
      lines.push(`${name}_sum ${sum}`);
      lines.push(`${name}_count ${count}`);
      
      // Percentiles
      const p50 = sorted[Math.floor(count * 0.5)];
      const p90 = sorted[Math.floor(count * 0.9)];
      const p99 = sorted[Math.floor(count * 0.99)];
      
      lines.push(`${name}_bucket{le="0.5"} ${p50}`);
      lines.push(`${name}_bucket{le="0.9"} ${p90}`);
      lines.push(`${name}_bucket{le="0.99"} ${p99}`);
    }

    return lines.join('\n');
  }

  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return '';
    const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return `{${pairs.join(',')}}`;
  }
}

// ============================================
// Singleton & Exports
// ============================================

export const health = new HealthCheckManager();
export const metrics = new MetricsRegistry();

export function createHealthManager(): HealthCheckManager {
  return new HealthCheckManager();
}

export default {
  health,
  metrics,
  databaseCheck,
  memoryCheck,
  diskCheck,
  httpCheck,
  redisCheck,
  customCheck,
  healthRoutes,
};
