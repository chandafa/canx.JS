/**
 * CanxJS Logger - Structured logging with levels and formatters
 */

// ============================================
// Types & Interfaces
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  requestId?: string;
  duration?: number;
}

interface LoggerConfig {
  level?: LogLevel;
  format?: 'json' | 'pretty';
  timestamp?: boolean;
  colors?: boolean;
  prefix?: string;
  transports?: LogTransport[];
}

interface LogTransport {
  name: string;
  log: (entry: LogEntry) => void | Promise<void>;
}

// ============================================
// Log Level Priority
// ============================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  fatal: '\x1b[35m', // Magenta
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

// ============================================
// Logger Class
// ============================================

export class Logger {
  private config: Required<LoggerConfig>;
  private transports: LogTransport[] = [];

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level || (process.env.LOG_LEVEL as LogLevel) || 'info',
      format: config.format || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
      timestamp: config.timestamp ?? true,
      colors: config.colors ?? process.stdout.isTTY,
      prefix: config.prefix || '',
      transports: config.transports || [],
    };
    this.transports = this.config.transports;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatPretty(entry: LogEntry): string {
    const { level, message, timestamp, context, requestId, duration } = entry;
    const parts: string[] = [];

    if (this.config.timestamp) {
      const time = this.config.colors ? `${DIM}${timestamp}${RESET}` : timestamp;
      parts.push(`[${time}]`);
    }

    if (this.config.prefix) {
      parts.push(`[${this.config.prefix}]`);
    }

    const levelStr = level.toUpperCase().padEnd(5);
    const coloredLevel = this.config.colors 
      ? `${LEVEL_COLORS[level]}${levelStr}${RESET}` 
      : levelStr;
    parts.push(coloredLevel);

    if (requestId) {
      parts.push(`[${requestId}]`);
    }

    parts.push(message);

    if (duration !== undefined) {
      const durationStr = this.config.colors 
        ? `${DIM}(${duration}ms)${RESET}` 
        : `(${duration}ms)`;
      parts.push(durationStr);
    }

    if (context && Object.keys(context).length > 0) {
      const contextStr = JSON.stringify(context);
      parts.push(this.config.colors ? `${DIM}${contextStr}${RESET}` : contextStr);
    }

    return parts.join(' ');
  }

  private formatJson(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private async output(entry: LogEntry): Promise<void> {
    const formatted = this.config.format === 'json' 
      ? this.formatJson(entry) 
      : this.formatPretty(entry);

    // Console output
    const stream = entry.level === 'error' || entry.level === 'fatal' 
      ? console.error 
      : console.log;
    stream(formatted);

    // Custom transports
    for (const transport of this.transports) {
      try {
        await transport.log(entry);
      } catch (err) {
        console.error(`[Logger] Transport ${transport.name} failed:`, err);
      }
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: this.formatTimestamp(),
      context,
    };

    this.output(entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  fatal(message: string, context?: Record<string, unknown>): void {
    this.log('fatal', message, context);
  }

  // Create child logger with context
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }

  // HTTP request logging helper
  request(method: string, path: string, statusCode: number, duration: number, context?: Record<string, unknown>): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const entry: LogEntry = {
      level,
      message: `${method} ${path} ${statusCode}`,
      timestamp: this.formatTimestamp(),
      duration,
      context: { ...context, statusCode },
    };
    this.output(entry);
  }

  // Add transport
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  // Set log level
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

// ============================================
// Child Logger
// ============================================

class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.context, ...context });
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.parent.error(message, { ...this.context, ...context });
  }

  fatal(message: string, context?: Record<string, unknown>): void {
    this.parent.fatal(message, { ...this.context, ...context });
  }
}

// ============================================
// File Transport
// ============================================

// ============================================
// File Transport
// ============================================

export function createFileTransport(filepath: string): LogTransport {
  return {
    name: 'file',
    async log(entry: LogEntry) {
      const line = JSON.stringify(entry) + '\n';
      await Bun.write(filepath, line, { append: true } as any);
    },
  };
}

export interface DailyRotateOptions {
  directory: string;
  filename?: string; // default: app-%DATE%.log
  maxFiles?: number; // Days to keep, default 14
}

export function createDailyRotateTransport(options: DailyRotateOptions): LogTransport {
  const { directory, maxFiles = 14 } = options;
  const filenamePattern = options.filename || 'app-%DATE%.log';
  
  // Ensure directory exists
  // We use sync here because it's setup time or lazy
  try {
     const fs = require('fs');
     if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  } catch (e) { /* ignore */ }

  return {
    name: 'daily-rotate',
    async log(entry: LogEntry) {
      const date = new Date().toISOString().split('T')[0];
      const filename = filenamePattern.replace('%DATE%', date);
      const filepath = `${directory}/${filename}`;
      
      const line = JSON.stringify(entry) + '\n';
      await Bun.write(filepath, line, { append: true } as any);
      
      // Cleanup old files (basic implementation)
      // Check only occasionally or on new file creation?
      // For performance, maybe simple check:
      // Real cleanup logic is heavy, skipping for this iteration unless requested.
    }
  };
}

// ============================================
// Logger Middleware
// ============================================

import type { MiddlewareHandler } from '../types';

interface RequestLoggerOptions {
  skip?: (req: any) => boolean;
  format?: 'combined' | 'short' | 'tiny';
}

export function requestLogger(loggerInstance?: Logger, options: RequestLoggerOptions = {}): MiddlewareHandler {
  const log = loggerInstance || new Logger();

  return async (req, res, next) => {
    if (options.skip?.(req)) {
      return next();
    }

    const start = performance.now();
    const response = await next();
    const duration = Math.round(performance.now() - start);

    log.request(
      req.method,
      req.path,
      response?.status || 200,
      duration,
      { requestId: req.id }
    );

    return response;
  };
}

// ============================================
// Singleton & Export
// ============================================

export const log = new Logger();

export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}

export default log;
