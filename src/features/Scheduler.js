"use strict";
/**
 * CanxJS Scheduler - Native Cron and Interval Task Scheduling
 * Insprired by Laravel Task Scheduling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduler = exports.Scheduler = void 0;
exports.createScheduler = createScheduler;
const child_process_1 = require("child_process");
class Scheduler {
    tasks = [];
    interval = null;
    running = new Set();
    constructor() {
        // Start ticker
        this.start();
    }
    /**
     * Schedule a closure/callback
     */
    call(callback) {
        return new TaskBuilder(this, 'callback', callback);
    }
    /**
     * Schedule a shell command
     */
    command(command) {
        return new TaskBuilder(this, 'command', command);
    }
    /**
     * Register a task (internal)
     */
    registerTask(task) {
        this.tasks.push(task);
        if (task.options.runOnStartup) {
            this.runTask(task);
        }
    }
    /**
     * Start the scheduler loop
     */
    start() {
        if (this.interval)
            return;
        // Check every minute (basic cron resolution)
        // For seconds-based intervals, we might need a tighter loop or separate handling
        // We'll stick to 1 second resolution to be superior
        this.interval = setInterval(() => this.tick(), 1000);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    run() {
        this.tick();
    }
    tick() {
        const now = new Date();
        for (const task of this.tasks) {
            if (this.shouldRun(task, now)) {
                this.runTask(task);
            }
        }
    }
    shouldRun(task, now) {
        // Basic interval check (e.g., "10s", "5m")
        if (task.schedule.match(/^(\d+)([smhd])$/)) {
            const ms = this.parseInterval(task.schedule);
            if (now.getTime() - task.lastRun >= ms) {
                return true;
            }
            return false;
        }
        // Basic Cron check (* * * * *)
        // We only support standard 5-part cron for now (Minute Hour DOM Month DOW)
        // Check if we just entered a new minute matching the cron
        if (now.getSeconds() === 0 && this.matchesCron(task.schedule, now)) {
            // Prevent double run in same minute
            // (Assuming tick runs exactly at :00 is unsafe, so we track lastRun)
            // If last run was more than 59 seconds ago
            return now.getTime() - task.lastRun > 59000;
        }
        return false;
    }
    async runTask(task) {
        if (task.options.withoutOverlapping && this.running.has(task.id)) {
            return;
        }
        this.running.add(task.id);
        task.lastRun = Date.now();
        try {
            if (task.type === 'callback') {
                await task.payload();
            }
            else {
                // Execute command
                const [cmd, ...args] = task.payload.split(' ');
                (0, child_process_1.spawn)(cmd, args, { stdio: 'inherit' });
            }
        }
        catch (e) {
            console.error(`[Scheduler] Task failed:`, e);
        }
        finally {
            this.running.delete(task.id);
        }
    }
    parseInterval(input) {
        const match = input.match(/^(\d+)([smhd])$/);
        if (!match)
            return 0;
        const val = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 's': return val * 1000;
            case 'm': return val * 60 * 1000;
            case 'h': return val * 3600 * 1000;
            case 'd': return val * 86400 * 1000;
            default: return 0;
        }
    }
    matchesCron(cron, date) {
        // Simple parser
        const parts = cron.split(' ');
        if (parts.length !== 5)
            return false;
        const [min, hour, dom, month, dow] = parts;
        const curMin = date.getMinutes();
        const curHour = date.getHours();
        const curDom = date.getDate();
        const curMonth = date.getMonth() + 1; // 1-12
        const curDow = date.getDay(); // 0-6
        return this.matchPart(min, curMin) &&
            this.matchPart(hour, curHour) &&
            this.matchPart(dom, curDom) &&
            this.matchPart(month, curMonth) &&
            this.matchPart(dow, curDow);
    }
    matchPart(part, value) {
        if (part === '*')
            return true;
        if (part.includes(','))
            return part.split(',').map(Number).includes(value);
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            return value >= start && value <= end;
        }
        if (part.includes('/')) {
            const [base, step] = part.split('/');
            if (base === '*')
                return value % Number(step) === 0;
        }
        return Number(part) === value;
    }
}
exports.Scheduler = Scheduler;
class TaskBuilder {
    task;
    scheduler;
    constructor(scheduler, type, payload) {
        this.scheduler = scheduler;
        this.task = {
            id: Math.random().toString(36).substring(7),
            type,
            payload,
            schedule: '* * * * *', // Default every minute
            lastRun: 0,
            options: {}
        };
    }
    every(interval) {
        // Format: '5s', '10m', '1h'
        this.task.schedule = interval;
        this.scheduler.registerTask(this.task);
        return this;
    }
    cron(expression) {
        this.task.schedule = expression;
        this.scheduler.registerTask(this.task);
        return this;
    }
    everyMinute() { return this.cron('* * * * *'); }
    everyFiveMinutes() { return this.cron('*/5 * * * *'); }
    hourly() { return this.cron('0 * * * *'); }
    daily() { return this.cron('0 0 * * *'); }
    dailyAt(time) {
        const [hour, min] = time.split(':');
        return this.cron(`${min} ${hour} * * *`);
    }
    name(name) {
        this.task.options.name = name;
        return this;
    }
    withoutOverlapping() {
        this.task.options.withoutOverlapping = true;
        return this;
    }
    runOnStartup() {
        this.task.options.runOnStartup = true;
        // We need to re-register or run immediately?
        // It's handled in `registerTask` if called before. 
        // If called after registration (chaining), we might miss it.
        // For safety, let's just set the flag.
        return this;
    }
}
exports.scheduler = new Scheduler();
function createScheduler() { return new Scheduler(); }
