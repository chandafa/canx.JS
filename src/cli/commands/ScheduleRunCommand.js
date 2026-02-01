"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleRunCommand = void 0;
const Scheduler_1 = require("../../features/Scheduler");
const picocolors_1 = __importDefault(require("picocolors"));
class ScheduleRunCommand {
    signature = 'schedule:run';
    description = 'Run the scheduled tasks';
    async handle() {
        console.log(picocolors_1.default.gray('Running scheduled tasks...'));
        // We assume tasks are registered in the application entry point.
        // However, when running via CLI, we might need to boot the app/kernel to register tasks?
        // In CanxJS, tasks might be defined in `routes/console.ts` or similar?
        // For now, we assume the environment is loaded.
        try {
            Scheduler_1.scheduler.run();
            // Note: run() is async-ish (runTask is async but tick is sync loop).
            // Since we don't await the tasks in tick currently, this might finish effectively immediately.
            // But for a system cron, that's usually fine.
            console.log(picocolors_1.default.green('Schedule run completed.'));
        }
        catch (e) {
            console.error(picocolors_1.default.red('Schedule run failed:'), e.message);
        }
    }
}
exports.ScheduleRunCommand = ScheduleRunCommand;
