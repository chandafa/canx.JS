/**
 * CanxJS Logger - Structured logging with levels and formatters
 */
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
export declare class Logger {
    private config;
    private transports;
    constructor(config?: LoggerConfig);
    private shouldLog;
    private formatTimestamp;
    private formatPretty;
    private formatJson;
    private output;
    private log;
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
    fatal(message: string, context?: Record<string, unknown>): void;
    child(context: Record<string, unknown>): ChildLogger;
    request(method: string, path: string, statusCode: number, duration: number, context?: Record<string, unknown>): void;
    addTransport(transport: LogTransport): void;
    setLevel(level: LogLevel): void;
}
declare class ChildLogger {
    private parent;
    private context;
    constructor(parent: Logger, context: Record<string, unknown>);
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
    fatal(message: string, context?: Record<string, unknown>): void;
}
export declare function createFileTransport(filepath: string): LogTransport;
export interface DailyRotateOptions {
    directory: string;
    filename?: string;
    maxFiles?: number;
}
export declare function createDailyRotateTransport(options: DailyRotateOptions): LogTransport;
import type { MiddlewareHandler } from '../types';
interface RequestLoggerOptions {
    skip?: (req: any) => boolean;
    format?: 'combined' | 'short' | 'tiny';
}
export declare function requestLogger(loggerInstance?: Logger, options?: RequestLoggerOptions): MiddlewareHandler;
export declare const log: Logger;
export declare function createLogger(config?: LoggerConfig): Logger;
export default log;
