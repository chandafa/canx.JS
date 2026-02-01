/**
 * CanxJS Scheduler - Native Cron and Interval Task Scheduling
 * Insprired by Laravel Task Scheduling
 */
type TaskCallback = () => void | Promise<void>;
interface Task {
    id: string;
    type: 'callback' | 'command';
    payload: TaskCallback | string;
    schedule: string;
    lastRun: number;
    options: TaskOptions;
}
interface TaskOptions {
    name?: string;
    withoutOverlapping?: boolean;
    runOnStartup?: boolean;
}
export declare class Scheduler {
    private tasks;
    private interval;
    private running;
    constructor();
    /**
     * Schedule a closure/callback
     */
    call(callback: TaskCallback): TaskBuilder;
    /**
     * Schedule a shell command
     */
    command(command: string): TaskBuilder;
    /**
     * Register a task (internal)
     */
    registerTask(task: Task): void;
    /**
     * Start the scheduler loop
     */
    start(): void;
    stop(): void;
    run(): void;
    private tick;
    private shouldRun;
    private runTask;
    private parseInterval;
    private matchesCron;
    private matchPart;
}
declare class TaskBuilder {
    private task;
    private scheduler;
    constructor(scheduler: Scheduler, type: 'callback' | 'command', payload: TaskCallback | string);
    every(interval: string): this;
    cron(expression: string): this;
    everyMinute(): this;
    everyFiveMinutes(): this;
    hourly(): this;
    daily(): this;
    dailyAt(time: string): this;
    name(name: string): this;
    withoutOverlapping(): this;
    runOnStartup(): this;
}
export declare const scheduler: Scheduler;
export declare function createScheduler(): Scheduler;
export {};
