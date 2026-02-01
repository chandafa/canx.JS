/**
 * CanxJS Audit Logger - Enterprise immutable audit trails
 * @description Records all critical system actions for compliance (SOC2, GDPR)
 */

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: {
    id: string;
    type: 'user' | 'system' | 'service';
    ip?: string;
    userAgent?: string;
  };
  resource: {
    type: string;
    id: string;
    before?: unknown;
    after?: unknown;
  };
  status: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  timestamp: Date;
  traceId?: string;
}

export interface AuditLoggerConfig {
  enabled?: boolean;
  driver?: AuditLogDriver;
  redactKeys?: string[]; // Keys to redact from metadata/resource (e.g., 'password')
}

export interface AuditLogDriver {
  log(entry: AuditLogEntry): Promise<void>;
  query?(filters: AuditLogFilters): Promise<AuditLogEntry[]>;
}

export interface AuditLogFilters {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  status?: 'success' | 'failure';
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

/**
 * Console Driver (Development)
 */
export class ConsoleAuditDriver implements AuditLogDriver {
  async log(entry: AuditLogEntry): Promise<void> {
    console.log(`[AUDIT] [${entry.timestamp.toISOString()}] ${entry.action} by ${entry.actor.type}:${entry.actor.id}`);
  }
}

/**
 * JSON File Driver (Simple Persistence)
 */
export class FileAuditDriver implements AuditLogDriver {
  constructor(private filePath: string = 'audit.log') {}

  async log(entry: AuditLogEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    await Bun.write(this.filePath, line);
  }
}

/**
 * Audit Logger Service
 */
export class AuditLogger {
  private config: Required<AuditLoggerConfig>;

  constructor(config: AuditLoggerConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      driver: config.driver ?? new ConsoleAuditDriver(),
      redactKeys: config.redactKeys ?? ['password', 'token', 'secret', 'credit_card'],
    };
  }

  /**
   * Record an action
   */
  async log(
    action: string,
    actor: AuditLogEntry['actor'],
    resource: AuditLogEntry['resource'],
    status: 'success' | 'failure' = 'success',
    metadata?: Record<string, unknown>,
    traceId?: string
  ): Promise<void> {
    if (!this.config.enabled) return;

    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      action,
      actor,
      resource: this.redact(resource),
      status,
      metadata: this.redact(metadata),
      timestamp: new Date(),
      traceId,
    };

    try {
      await this.config.driver.log(entry);
    } catch (error) {
      console.error('[AuditLogger] Failed to write audit log:', error);
      // Fail-safe: don't crash the app if audit logging fails, usually
      // Ideally, for high compliance, we might want to throw or alert
    }
  }

  /**
   * Redact sensitive information
   */
  private redact<T>(data: T): T {
    if (!data || typeof data !== 'object') return data;
    
    // Deep clone to avoid mutating original
    const clone = JSON.parse(JSON.stringify(data));
    
    const redactHelper = (obj: any) => {
      for (const key in obj) {
        if (this.config.redactKeys.includes(key.toLowerCase())) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          redactHelper(obj[key]);
        }
      }
    };

    redactHelper(clone);
    return clone;
  }
}

// ============================================
// Factory & Decorators
// ============================================

let defaultAuditLogger: AuditLogger | null = null;

export function initAuditLogger(config?: AuditLoggerConfig): AuditLogger {
  defaultAuditLogger = new AuditLogger(config);
  return defaultAuditLogger;
}

export function auditLogger(): AuditLogger {
  if (!defaultAuditLogger) {
    defaultAuditLogger = new AuditLogger();
  }
  return defaultAuditLogger;
}

/**
 * Decorator to audit method execution
 */
export function Audit(action: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const logger = auditLogger();
      // Try to extract actor from 'this' context (common in Controllers)
      const req = (this as any).request || (this as any).req;
      const user = req?.user;
      
      const starTime = Date.now();
      let status: 'success' | 'failure' = 'success';
      let error: any;

      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } catch (e) {
        status = 'failure';
        error = e;
        throw e;
      } finally {
        // Async log to not block response
        logger.log(
          action,
          {
            id: user?.id || 'anonymous',
            type: user ? 'user' : 'system',
            ip: req?.ip,
            userAgent: req?.headers?.get('user-agent'),
          },
          {
            type: target.constructor.name,
            id: propertyKey,
            // Capture args if appropriate? careful with sensitive data in args
          },
          status,
          { error: error?.message, duration: Date.now() - starTime }
        ).catch(e => console.error('Audit decorator failed:', e));
      }
    };
    
    return descriptor;
  };
}

export default AuditLogger;
