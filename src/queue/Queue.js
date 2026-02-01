"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisDriver = exports.MemoryDriver = exports.queue = exports.Queue = void 0;
exports.createQueue = createQueue;
const MemoryDriver_1 = require("./drivers/MemoryDriver");
class Queue {
    driver;
    config;
    running = false;
    processing = false;
    handlers = new Map();
    timer = null;
    concurrency;
    constructor(config = {}) {
        this.config = config;
        this.concurrency = config.concurrency || 5;
        // Default to Memory Driver
        if (config.connections?.redis && config.default === 'redis') {
            // Allow dynamic injection of Redis client or driver
            // For now, we default to memory if no driver instance provided externally
            // In a real app, we would load RedisDriver here
            console.warn('[Queue] Redis driver requires manual setup or injection. Defaulting to Memory.');
            this.driver = config.driverInstance || new MemoryDriver_1.MemoryDriver();
        }
        else {
            this.driver = new MemoryDriver_1.MemoryDriver();
        }
    }
    /**
     * Use a specific driver instance
     */
    use(driver) {
        this.driver = driver;
        return this;
    }
    /**
     * Define a job handler
     */
    define(name, handler) {
        this.handlers.set(name, handler);
    }
    /**
     * Dispatch a job immediately
     */
    async dispatch(name, data = {}) {
        return this.driver.push({ name, data, delay: 0, maxAttempts: 3, scheduledAt: Date.now() });
    }
    /**
     * Schedule a job to run later
     */
    async schedule(name, data, delay) {
        const delayMs = typeof delay === 'string' ? this.parseDelay(delay) : delay;
        return this.driver.push({ name, data, delay: delayMs, maxAttempts: 3, scheduledAt: Date.now() + delayMs });
    }
    /**
     * Start processing jobs
     */
    start() {
        if (this.running)
            return;
        this.running = true;
        console.log('[Queue] Worker started');
        this.process();
    }
    /**
     * Stop processing jobs
     */
    stop() {
        this.running = false;
        if (this.timer)
            clearTimeout(this.timer);
        console.log('[Queue] Worker stopped');
    }
    async process() {
        if (!this.running)
            return;
        if (this.processing) {
            this.timer = setTimeout(() => this.process(), 100);
            return;
        }
        this.processing = true;
        try {
            const job = await this.driver.pop();
            if (job) {
                await this.handleJob(job);
                // If we found a job, try to get another one immediately
                this.processing = false;
                setImmediate(() => this.process());
                return;
            }
        }
        catch (e) {
            console.error('[Queue] Error processing job:', e);
        }
        finally {
            this.processing = false;
        }
        // No job found, wait a bit
        this.timer = setTimeout(() => this.process(), 1000);
    }
    async handleJob(job) {
        const handler = this.handlers.get(job.name);
        if (!handler) {
            console.error(`[Queue] No handler for ${job.name}`);
            await this.driver.fail(job, new Error('No handler'));
            return;
        }
        try {
            await handler(job.data);
            await this.driver.complete(job);
        }
        catch (e) {
            console.error(`[Queue] Failed ${job.name}:`, e);
            if (job.attempts < job.maxAttempts) {
                // Retry logic usually depends on driver, but here we explicitly release
                await this.driver.release(job, 5000 * (job.attempts + 1));
            }
            else {
                await this.driver.fail(job, e);
            }
        }
    }
    /**
     * Stats and maintenance
     */
    async getStats() {
        return this.driver.getStats();
    }
    async getFailed(offset, limit) {
        return this.driver.getFailed(offset, limit);
    }
    async getPending(offset, limit) {
        return this.driver.getPending(offset, limit);
    }
    async retry(jobId) {
        return this.driver.retry(jobId);
    }
    async clear() {
        return this.driver.clear();
    }
    parseDelay(delay) {
        const match = delay.match(/^(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hour|hours|d|day|days)$/i);
        if (!match)
            return 0;
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        switch (unit) {
            case 's':
            case 'sec': return value * 1000;
            case 'm':
            case 'min': return value * 60 * 1000;
            case 'h':
            case 'hour': return value * 60 * 60 * 1000;
            case 'd':
            case 'day': return value * 24 * 60 * 60 * 1000;
            default: return 0;
        }
    }
}
exports.Queue = Queue;
exports.queue = new Queue();
function createQueue(config) { return new Queue(config); }
var MemoryDriver_2 = require("./drivers/MemoryDriver");
Object.defineProperty(exports, "MemoryDriver", { enumerable: true, get: function () { return MemoryDriver_2.MemoryDriver; } });
var RedisDriver_1 = require("./drivers/RedisDriver");
Object.defineProperty(exports, "RedisDriver", { enumerable: true, get: function () { return RedisDriver_1.RedisDriver; } });
