"use strict";
/**
 * CanxJS Health Check Module
 * Inspired by @nestjs/terminus
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthModule = exports.HealthCheckService = exports.DiskHealthIndicator = exports.MemoryHealthIndicator = exports.DatabaseHealthIndicator = exports.HealthIndicator = exports.HealthCheckError = void 0;
const Module_1 = require("../core/Module");
const Model_1 = require("../mvc/Model");
class HealthCheckError extends Error {
    message;
    causes;
    constructor(message, causes) {
        super(message);
        this.message = message;
        this.causes = causes;
        this.name = 'HealthCheckError';
    }
}
exports.HealthCheckError = HealthCheckError;
// ============================================
// Base Indicator
// ============================================
class HealthIndicator {
    getStatus(key, isHealthy, data) {
        return {
            [key]: {
                status: isHealthy ? 'up' : 'down',
                ...data,
            },
        };
    }
}
exports.HealthIndicator = HealthIndicator;
// ============================================
// Concrete Indicators
// ============================================
/**
 * Check Database Connection Health
 */
let DatabaseHealthIndicator = class DatabaseHealthIndicator extends HealthIndicator {
    async pingCheck(key, options = {}) {
        const timeout = options.timeout || 1000;
        try {
            // Execute simple query using internal ORM
            const promise = (0, Model_1.query)('SELECT 1');
            const result = await Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
            ]);
            return this.getStatus(key, true);
        }
        catch (e) {
            throw new HealthCheckError('Database check failed', this.getStatus(key, false, { message: e.message }));
        }
    }
};
exports.DatabaseHealthIndicator = DatabaseHealthIndicator;
exports.DatabaseHealthIndicator = DatabaseHealthIndicator = __decorate([
    (0, Module_1.Injectable)()
], DatabaseHealthIndicator);
/**
 * Check Memory Usage
 */
let MemoryHealthIndicator = class MemoryHealthIndicator extends HealthIndicator {
    async checkHeap(key, thresholdInBytes) {
        const usage = process.memoryUsage().heapUsed;
        const isHealthy = usage < thresholdInBytes;
        if (!isHealthy) {
            throw new HealthCheckError('Heap usage exceeded threshold', this.getStatus(key, false, { usage, threshold: thresholdInBytes }));
        }
        return this.getStatus(key, true, { usage, threshold: thresholdInBytes });
    }
    async checkRSS(key, thresholdInBytes) {
        const usage = process.memoryUsage().rss;
        const isHealthy = usage < thresholdInBytes;
        if (!isHealthy) {
            throw new HealthCheckError('RSS usage exceeded threshold', this.getStatus(key, false, { usage, threshold: thresholdInBytes }));
        }
        return this.getStatus(key, true, { usage, threshold: thresholdInBytes });
    }
};
exports.MemoryHealthIndicator = MemoryHealthIndicator;
exports.MemoryHealthIndicator = MemoryHealthIndicator = __decorate([
    (0, Module_1.Injectable)()
], MemoryHealthIndicator);
/**
 * Check Disk Storage (requires 'check-disk-space' or similar in real world, using stub/fs logic here)
 * For basic implementation without deps, we might skip full disk check or use `fs` stats if possible.
 * But `fs` doesn't give free space easily in Node without executing `df`.
 * We'll check readability of a path instead for now.
 */
let DiskHealthIndicator = class DiskHealthIndicator extends HealthIndicator {
    async checkStorage(key, options) {
        // Need external lib or platform specific command for disk space.
        // For now, we perform a simpler check: can we write to the path?
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const testFile = `${options.path}/.healthcheck`;
            await fs.writeFile(testFile, 'ok');
            await fs.unlink(testFile);
            return this.getStatus(key, true);
        }
        catch (e) {
            throw new HealthCheckError('Disk integrity check failed', this.getStatus(key, false, { message: e.message }));
        }
    }
};
exports.DiskHealthIndicator = DiskHealthIndicator;
exports.DiskHealthIndicator = DiskHealthIndicator = __decorate([
    (0, Module_1.Injectable)()
], DiskHealthIndicator);
// ============================================
// Service
// ============================================
let HealthCheckService = class HealthCheckService {
    async check(checks) {
        const results = [];
        const errors = [];
        await Promise.all(checks.map(async (check) => {
            try {
                const result = await check();
                results.push(result);
            }
            catch (e) {
                if (e instanceof HealthCheckError) {
                    errors.push(e.causes);
                }
                else {
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
};
exports.HealthCheckService = HealthCheckService;
exports.HealthCheckService = HealthCheckService = __decorate([
    (0, Module_1.Injectable)()
], HealthCheckService);
// ============================================
// Module
// ============================================
let HealthModule = class HealthModule {
};
exports.HealthModule = HealthModule;
exports.HealthModule = HealthModule = __decorate([
    (0, Module_1.CanxModule)({
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
], HealthModule);
