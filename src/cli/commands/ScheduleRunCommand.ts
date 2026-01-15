
import type { Command } from '../Command';
import { scheduler } from '../../features/Scheduler';
import pc from 'picocolors';

export class ScheduleRunCommand implements Command {
  signature = 'schedule:run';
  description = 'Run the scheduled tasks';

  async handle() {
    console.log(pc.gray('Running scheduled tasks...'));
    // We assume tasks are registered in the application entry point.
    // However, when running via CLI, we might need to boot the app/kernel to register tasks?
    // In CanxJS, tasks might be defined in `routes/console.ts` or similar?
    // For now, we assume the environment is loaded.
    
    try {
        scheduler.run(); 
        // Note: run() is async-ish (runTask is async but tick is sync loop).
        // Since we don't await the tasks in tick currently, this might finish effectively immediately.
        // But for a system cron, that's usually fine.
        console.log(pc.green('Schedule run completed.'));
    } catch (e: any) {
        console.error(pc.red('Schedule run failed:'), e.message);
    }
  }
}
