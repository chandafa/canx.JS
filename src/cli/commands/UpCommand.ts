import pc from 'picocolors';
import type { Command } from '../Command';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

/**
 * UpCommand - Bring the application out of maintenance mode
 * 
 * Usage:
 *   canx up
 */
export class UpCommand implements Command {
  signature = 'up';
  description = 'Bring the application out of maintenance mode';

  async handle(args: string[], flags: Record<string, any>): Promise<void> {
    const cwd = process.cwd();
    const maintenanceFile = join(cwd, '.maintenance');

    // Check if in maintenance mode
    if (!existsSync(maintenanceFile)) {
      console.log(pc.yellow('Application is not in maintenance mode.'));
      return;
    }

    // Remove maintenance file
    try {
      unlinkSync(maintenanceFile);
      
      console.log();
      console.log(pc.bgGreen(pc.black(' APPLICATION ONLINE ')));
      console.log();
      console.log(pc.green('Application is now live.'));
      console.log();
    } catch (error) {
      console.error(pc.red('Failed to bring application online:'), error);
    }
  }
}
