/**
 * CanxJS Health Check Module
 * Inspired by @nestjs/terminus
 */

import { Injectable, CanxModule } from '../core/Module';
import { Model, query } from '../mvc/Model';
import type { DatabaseConfig } from '../types';

// ============================================
// Types & Errors
// ============================================

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

export class HealthCheckError extends Error {
  constructor(
    public message: string,
    public causes: any
  ) {
    super(message);
    this.name = 'HealthCheckError';
  }
}

// ============================================
// Base Indicator
// ============================================

export abstract class HealthIndicator {
  protected getStatus(key: string, isHealthy: boolean, data?: { [key: string]: any }): HealthIndicatorResult {
    return {
      [key]: {
        status: isHealthy ? 'up' : 'down',
        ...data,
      },
    };
  }
}

// ============================================
// Concrete Indicators
// ============================================

/**
 * Check Database Connection Health
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  async pingCheck(key: string, options: { timeout?: number } = {}): Promise<HealthIndicatorResult> {
    const timeout = options.timeout || 1000;
    try {
      // Execute simple query using internal ORM
      const promise = query('SELECT 1');
      
      const result = await Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
      ]);
      
      return this.getStatus(key, true);
    } catch (e: any) {
      throw new HealthCheckError('Database check failed', this.getStatus(key, false, { message: e.message }));
    }
  }
}

/**
 * Check Memory Usage
 */
@Injectable()
export class MemoryHealthIndicator extends HealthIndicator {
  async checkHeap(key: string, thresholdInBytes: number): Promise<HealthIndicatorResult> {
    const usage = process.memoryUsage().heapUsed;
    const isHealthy = usage < thresholdInBytes;
    
    if (!isHealthy) {
       throw new HealthCheckError(
         'Heap usage exceeded threshold', 
         this.getStatus(key, false, { usage, threshold: thresholdInBytes })
       );
    }

    return this.getStatus(key, true, { usage, threshold: thresholdInBytes });
  }

  async checkRSS(key: string, thresholdInBytes: number): Promise<HealthIndicatorResult> {
    const usage = process.memoryUsage().rss;
    const isHealthy = usage < thresholdInBytes;
    
     if (!isHealthy) {
       throw new HealthCheckError(
         'RSS usage exceeded threshold', 
         this.getStatus(key, false, { usage, threshold: thresholdInBytes })
       );
    }

    return this.getStatus(key, true, { usage, threshold: thresholdInBytes });
  }
}

/**
 * Check Disk Storage (requires 'check-disk-space' or similar in real world, using stub/fs logic here)
 * For basic implementation without deps, we might skip full disk check or use `fs` stats if possible.
 * But `fs` doesn't give free space easily in Node without executing `df`.
 * We'll check readability of a path instead for now.
 */
@Injectable()
export class DiskHealthIndicator extends HealthIndicator {
  async checkStorage(key: string, options: { path: string, thresholdPercent?: number }): Promise<HealthIndicatorResult> {
    // Need external lib or platform specific command for disk space.
    // For now, we perform a simpler check: can we write to the path?
    try {
       const fs = await import('fs/promises');
       const testFile = `${options.path}/.healthcheck`;
       await fs.writeFile(testFile, 'ok');
       await fs.unlink(testFile);
       return this.getStatus(key, true);
    } catch(e: any) {
       throw new HealthCheckError('Disk integrity check failed', this.getStatus(key, false, { message: e.message }));
    }
  }
}

// ============================================
// Service
// ============================================

@Injectable()
export class HealthCheckService {
  async check(checks: (() => Promise<HealthIndicatorResult>)[]): Promise<HealthCheckResult> {
    const results: HealthIndicatorResult[] = [];
    const errors: HealthIndicatorResult[] = [];

    await Promise.all(checks.map(async (check) => {
      try {
        const result = await check();
        results.push(result);
      } catch (e: any) {
        if (e instanceof HealthCheckError) {
          errors.push(e.causes);
        } else {
          // Wrap unknown errors
          errors.push({ 'unknown': { status: 'down', message: e.message } });
        }
      }
    }));

    const info = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    const errorInfo = errors.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    
    const details = { ...info, ...errorInfo };
    const status = errors.length > 0 ? 'error' : 'ok';

    if (status === 'error') {
       // In NestJS Terminus, check() throws if any failing. 
       // We can return the result but throw a wrapping exception or allow user to handle status.
       // Usually we throw so the controller can catch and send 503.
       const finalResult = { status, info, error: errorInfo, details };
       throw new HealthCheckError('Health check failed', finalResult);
    }

    return { status, info, details };
  }
}

// ============================================
// Module
// ============================================

@CanxModule({
  providers: [
    DatabaseHealthIndicator,
    MemoryHealthIndicator,
    DiskHealthIndicator,
    HealthCheckService,
  ],
  exports: [
    DatabaseHealthIndicator,
    MemoryHealthIndicator,
    DiskHealthIndicator,
    HealthCheckService,
  ]
})
export class HealthModule {}
