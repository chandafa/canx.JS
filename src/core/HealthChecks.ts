/**
 * CanxJS Enhanced Health Checks - Kubernetes-ready health endpoints
 * @description Production-grade health checks with liveness, readiness, and startup probes
 */

export type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  duration?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  critical?: boolean;
}

export interface FullHealthReport {
  status: HealthStatus;
  version?: string;
  uptime: number;
  timestamp: string;
  checks: ComponentHealth[];
  system?: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu?: {
      load: number[];
    };
  };
}

export interface HealthCheckOptions {
  /** Timeout for individual checks in ms */
  timeout?: number;
  /** Include detailed system info */
  includeSystem?: boolean;
  /** App version */
  version?: string;
}

type HealthChecker = () => Promise<ComponentHealth>;

/**
 * Enhanced Health Check Manager
 */
export class HealthCheckManager {
  private checks: Map<string, HealthChecker> = new Map();
  private startTime: Date = new Date();
  private options: HealthCheckOptions;

  constructor(options: HealthCheckOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 5000,
      includeSystem: options.includeSystem ?? true,
      version: options.version ?? process.env.APP_VERSION ?? '1.0.0',
    };
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
  unregister(name: string): boolean {
    return this.checks.delete(name);
  }

  /**
   * Kubernetes Liveness Probe - Is the app alive?
   * Returns 200 if process is running
   */
  async liveness(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      duration: Date.now() - start,
      message: 'Application is alive',
    };
  }

  /**
   * Kubernetes Readiness Probe - Is the app ready to receive traffic?
   * Checks all registered health checks
   */
  async readiness(): Promise<HealthCheckResult> {
    const start = Date.now();
    const results = await this.runAllChecks();
    
    const hasUnhealthy = results.some(r => r.status === 'unhealthy' && r.critical !== false);
    const hasDegraded = results.some(r => r.status === 'degraded');
    
    let status: HealthStatus = 'healthy';
    if (hasUnhealthy) status = 'unhealthy';
    else if (hasDegraded) status = 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      duration: Date.now() - start,
      message: status === 'healthy' 
        ? 'All checks passed' 
        : `Some checks failed: ${results.filter(r => r.status !== 'healthy').map(r => r.name).join(', ')}`,
      details: {
        checks: results,
      },
    };
  }

  /**
   * Full Health Report - Detailed health status
   */
  async getFullReport(): Promise<FullHealthReport> {
    const results = await this.runAllChecks();
    
    const hasUnhealthy = results.some(r => r.status === 'unhealthy' && r.critical !== false);
    const hasDegraded = results.some(r => r.status === 'degraded');
    
    let status: HealthStatus = 'healthy';
    if (hasUnhealthy) status = 'unhealthy';
    else if (hasDegraded) status = 'degraded';

    const report: FullHealthReport = {
      status,
      version: this.options.version,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date().toISOString(),
      checks: results,
    };

    if (this.options.includeSystem) {
      const memUsage = process.memoryUsage();
      report.system = {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
      };
    }

    return report;
  }

  /**
   * Run all registered health checks
   */
  private async runAllChecks(): Promise<ComponentHealth[]> {
    const results: ComponentHealth[] = [];
    
    for (const [name, checker] of this.checks) {
      try {
        const start = Date.now();
        const timeoutPromise = new Promise<ComponentHealth>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), this.options.timeout);
        });
        
        const result = await Promise.race([checker(), timeoutPromise]);
        result.latency = Date.now() - start;
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          critical: true,
        });
      }
    }
    
    return results;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }
}

// ============================================
// Built-in Health Checkers
// ============================================

/**
 * Database health checker
 */
export function createDatabaseCheck(
  name: string,
  queryFn: () => Promise<unknown>,
  options: { critical?: boolean } = {}
): HealthChecker {
  return async (): Promise<ComponentHealth> => {
    try {
      await queryFn();
      return {
        name,
        status: 'healthy',
        message: 'Database connection OK',
        critical: options.critical ?? true,
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database error',
        critical: options.critical ?? true,
      };
    }
  };
}

/**
 * Redis health checker
 */
export function createRedisCheck(
  name: string,
  pingFn: () => Promise<string>,
  options: { critical?: boolean } = {}
): HealthChecker {
  return async (): Promise<ComponentHealth> => {
    try {
      const result = await pingFn();
      return {
        name,
        status: result === 'PONG' ? 'healthy' : 'degraded',
        message: result === 'PONG' ? 'Redis connection OK' : `Unexpected response: ${result}`,
        critical: options.critical ?? false,
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Redis error',
        critical: options.critical ?? false,
      };
    }
  };
}

/**
 * HTTP endpoint health checker
 */
export function createHttpCheck(
  name: string,
  url: string,
  options: { 
    method?: string; 
    timeout?: number; 
    expectedStatus?: number;
    critical?: boolean;
  } = {}
): HealthChecker {
  return async (): Promise<ComponentHealth> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeout ?? 5000);
      
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      const expectedStatus = options.expectedStatus ?? 200;
      if (response.status === expectedStatus) {
        return {
          name,
          status: 'healthy',
          message: `HTTP ${response.status} OK`,
          critical: options.critical ?? false,
        };
      } else {
        return {
          name,
          status: 'degraded',
          message: `Expected ${expectedStatus}, got ${response.status}`,
          critical: options.critical ?? false,
        };
      }
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'HTTP request failed',
        critical: options.critical ?? false,
      };
    }
  };
}

/**
 * Memory health checker
 */
export function createMemoryCheck(
  name: string = 'memory',
  options: { thresholdPercent?: number; critical?: boolean } = {}
): HealthChecker {
  return async (): Promise<ComponentHealth> => {
    const mem = process.memoryUsage();
    const percentage = Math.round((mem.heapUsed / mem.heapTotal) * 100);
    const threshold = options.thresholdPercent ?? 90;
    
    if (percentage >= threshold) {
      return {
        name,
        status: 'unhealthy',
        message: `Memory usage at ${percentage}% (threshold: ${threshold}%)`,
        critical: options.critical ?? false,
      };
    } else if (percentage >= threshold * 0.8) {
      return {
        name,
        status: 'degraded',
        message: `Memory usage at ${percentage}%`,
        critical: options.critical ?? false,
      };
    }
    
    return {
      name,
      status: 'healthy',
      message: `Memory usage at ${percentage}%`,
      critical: options.critical ?? false,
    };
  };
}

/**
 * Disk health checker
 */
export function createDiskCheck(
  name: string = 'disk',
  path: string = '.',
  options: { thresholdPercent?: number; critical?: boolean } = {}
): HealthChecker {
  return async (): Promise<ComponentHealth> => {
    // Note: Bun doesn't have built-in disk space checking
    // This is a placeholder that could be implemented with native bindings
    return {
      name,
      status: 'healthy',
      message: 'Disk check not implemented in Bun runtime',
      critical: options.critical ?? false,
    };
  };
}

/**
 * Custom health checker
 */
export function createCustomCheck(
  name: string,
  checkFn: () => Promise<boolean | { healthy: boolean; message?: string }>,
  options: { critical?: boolean } = {}
): HealthChecker {
  return async (): Promise<ComponentHealth> => {
    try {
      const result = await checkFn();
      const isHealthy = typeof result === 'boolean' ? result : result.healthy;
      const message = typeof result === 'object' ? result.message : undefined;
      
      return {
        name,
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: message ?? (isHealthy ? 'Check passed' : 'Check failed'),
        critical: options.critical ?? false,
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Check error',
        critical: options.critical ?? false,
      };
    }
  };
}

// ============================================
// Route Handlers
// ============================================

/**
 * Create health check route handlers
 */
export function createHealthRoutes(manager: HealthCheckManager) {
  return {
    /**
     * GET /health/live - Liveness probe
     */
    live: async () => {
      const result = await manager.liveness();
      return new Response(JSON.stringify(result), {
        status: result.status === 'healthy' ? 200 : 503,
        headers: { 'Content-Type': 'application/json' },
      });
    },

    /**
     * GET /health/ready - Readiness probe
     */
    ready: async () => {
      const result = await manager.readiness();
      return new Response(JSON.stringify(result), {
        status: result.status === 'healthy' ? 200 : 503,
        headers: { 'Content-Type': 'application/json' },
      });
    },

    /**
     * GET /health - Full health report
     */
    full: async () => {
      const result = await manager.getFullReport();
      return new Response(JSON.stringify(result, null, 2), {
        status: result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };
}

// ============================================
// Singleton Instance
// ============================================

let healthManager: HealthCheckManager | null = null;

/**
 * Initialize health check manager
 */
export function initHealthChecks(options?: HealthCheckOptions): HealthCheckManager {
  if (!healthManager) {
    healthManager = new HealthCheckManager(options);
  }
  return healthManager;
}

/**
 * Get health check manager
 */
export function healthChecks(): HealthCheckManager {
  if (!healthManager) {
    healthManager = new HealthCheckManager();
  }
  return healthManager;
}

export default HealthCheckManager;
