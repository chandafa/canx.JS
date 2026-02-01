"use strict";
/**
 * CanxJS Logger - Structured logging with levels and formatters
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.Logger = void 0;
exports.createFileTransport = createFileTransport;
exports.createDailyRotateTransport = createDailyRotateTransport;
exports.requestLogger = requestLogger;
exports.createLogger = createLogger;
// ============================================
// Log Level Priority
// ============================================
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
};
const LEVEL_COLORS = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m', // Green
    warn: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
    fatal: '\x1b[35m', // Magenta
};
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
// ============================================
// Logger Class
// ============================================
class Logger {
    config;
    transports = [];
    constructor(config = {}) {
        this.config = {
            level: config.level || process.env.LOG_LEVEL || 'info',
            format: config.format || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
            timestamp: config.timestamp ?? true,
            colors: config.colors ?? process.stdout.isTTY,
            prefix: config.prefix || '',
            transports: config.transports || [],
        };
        this.transports = this.config.transports;
    }
    shouldLog(level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
    }
    formatTimestamp() {
        return new Date().toISOString();
    }
    formatPretty(entry) {
        const { level, message, timestamp, context, requestId, duration } = entry;
        const parts = [];
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
    formatJson(entry) {
        return JSON.stringify(entry);
    }
    async output(entry) {
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
            }
            catch (err) {
                console.error(`[Logger] Transport ${transport.name} failed:`, err);
            }
        }
    }
    log(level, message, context) {
        if (!this.shouldLog(level))
            return;
        const entry = {
            level,
            message,
            timestamp: this.formatTimestamp(),
            context,
        };
        this.output(entry);
    }
    debug(message, context) {
        this.log('debug', message, context);
    }
    info(message, context) {
        this.log('info', message, context);
    }
    warn(message, context) {
        this.log('warn', message, context);
    }
    error(message, context) {
        this.log('error', message, context);
    }
    fatal(message, context) {
        this.log('fatal', message, context);
    }
    // Create child logger with context
    child(context) {
        return new ChildLogger(this, context);
    }
    // HTTP request logging helper
    request(method, path, statusCode, duration, context) {
        const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        const entry = {
            level,
            message: `${method} ${path} ${statusCode}`,
            timestamp: this.formatTimestamp(),
            duration,
            context: { ...context, statusCode },
        };
        this.output(entry);
    }
    // Add transport
    addTransport(transport) {
        this.transports.push(transport);
    }
    // Set log level
    setLevel(level) {
        this.config.level = level;
    }
}
exports.Logger = Logger;
// ============================================
// Child Logger
// ============================================
class ChildLogger {
    parent;
    context;
    constructor(parent, context) {
        this.parent = parent;
        this.context = context;
    }
    debug(message, context) {
        this.parent.debug(message, { ...this.context, ...context });
    }
    info(message, context) {
        this.parent.info(message, { ...this.context, ...context });
    }
    warn(message, context) {
        this.parent.warn(message, { ...this.context, ...context });
    }
    error(message, context) {
        this.parent.error(message, { ...this.context, ...context });
    }
    fatal(message, context) {
        this.parent.fatal(message, { ...this.context, ...context });
    }
}
// ============================================
// File Transport
// ============================================
// ============================================
// File Transport
// ============================================
function createFileTransport(filepath) {
    return {
        name: 'file',
        async log(entry) {
            const line = JSON.stringify(entry) + '\n';
            await Bun.write(filepath, line, { append: true });
        },
    };
}
function createDailyRotateTransport(options) {
    const { directory, maxFiles = 14 } = options;
    const filenamePattern = options.filename || 'app-%DATE%.log';
    // Ensure directory exists
    // We use sync here because it's setup time or lazy
    try {
        const fs = require('fs');
        if (!fs.existsSync(directory))
            fs.mkdirSync(directory, { recursive: true });
    }
    catch (e) { /* ignore */ }
    return {
        name: 'daily-rotate',
        async log(entry) {
            const date = new Date().toISOString().split('T')[0];
            const filename = filenamePattern.replace('%DATE%', date);
            const filepath = `${directory}/${filename}`;
            const line = JSON.stringify(entry) + '\n';
            await Bun.write(filepath, line, { append: true });
            // Cleanup old files (basic implementation)
            // Check only occasionally or on new file creation?
            // For performance, maybe simple check:
            // Real cleanup logic is heavy, skipping for this iteration unless requested.
        }
    };
}
function requestLogger(loggerInstance, options = {}) {
    const log = loggerInstance || new Logger();
    return async (req, res, next) => {
        if (options.skip?.(req)) {
            return next();
        }
        const start = performance.now();
        const response = await next();
        const duration = Math.round(performance.now() - start);
        log.request(req.method, req.path, response?.status || 200, duration, { requestId: req.id });
        return response;
    };
}
// ============================================
// Singleton & Export
// ============================================
exports.log = new Logger();
function createLogger(config) {
    return new Logger(config);
}
exports.default = exports.log;
