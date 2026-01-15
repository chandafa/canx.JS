import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import pc from 'picocolors';
import type { Command } from '../Command';
import { queue } from '../../queue/Queue';

export class QueueWorkCommand implements Command {
  signature = 'queue:work';
  description = 'Start the queue worker';

  async handle(args: string[], flags: Record<string, any>) {
    const cwd = process.cwd();

    // 1. Load Config (Optional, logic in Queue.ts handles defaults)
    // But if user has config, we might want to load it.
    // Actually Queue is singleton. If app hasn't started, Queue needs config.
    const configPath = join(cwd, 'src/config/queue.ts');
    if (existsSync(configPath)) {
        try {
            const module = await import(configPath);
            // Assuming config exports default object or similar.
            // But Queue singleton is already instantiated.
            // We might need a reconfigure method or just assume config sets the driver on the singleton if it imports it.
            // But user config usually exports a simple object.
            // We'll leave this for now. The framework should probably auto-load config in a simpler way.
        } catch(e) {
            console.error(pc.red('Failed to load queue config'), e);
        }
    }

    // 2. Load Jobs
    const jobsDir = join(cwd, 'src/queue/jobs');
    if (existsSync(jobsDir)) {
      const files = readdirSync(jobsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
      console.log(pc.blue(`[Queue] Loading ${files.length} job definitions...`));
      for (const file of files) {
        await import(join(jobsDir, file));
      }
    } else {
        console.warn(pc.yellow('[Queue] No jobs directory found at src/queue/jobs'));
    }

    // 3. Start
    console.log(pc.green('[Queue] Starting worker...'));
    queue.start();
    
    // Keep alive? Queue.start() might be async or just setup timers.
    // Queue.ts start() sets running=true and calls process() which sets timeouts.
    // Node process won't exit if there are active timeouts.
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log(pc.yellow('\n[Queue] Stopping...'));
        queue.stop();
        process.exit(0);
    });
  }
}
