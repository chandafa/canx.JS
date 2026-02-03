import pc from 'picocolors';
import type { Command } from '../Command';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

/**
 * DownCommand - Put the application into maintenance mode
 * 
 * Usage:
 *   canx down
 *   canx down --message="Deploying new features"
 *   canx down --retry=60
 *   canx down --secret="bypass-key"
 *   canx down --redirect="/maintenance"
 */
export class DownCommand implements Command {
  signature = 'down';
  description = 'Put the application into maintenance mode';

  async handle(args: string[], flags: Record<string, any>): Promise<void> {
    const cwd = process.cwd();
    const maintenanceFile = join(cwd, '.maintenance');

    // Check if already in maintenance mode
    if (existsSync(maintenanceFile)) {
      console.log(pc.yellow('Application is already in maintenance mode.'));
      return;
    }

    // Build payload from flags
    const payload = {
      time: Date.now(),
      message: flags.message || 'Service Unavailable',
      retry: flags.retry ? parseInt(flags.retry, 10) : undefined,
      refresh: flags.refresh ? parseInt(flags.refresh, 10) : undefined,
      secret: flags.secret || undefined,
      status: flags.status ? parseInt(flags.status, 10) : 503,
      redirect: flags.redirect || undefined,
      except: flags.except ? flags.except.split(',').map((s: string) => s.trim()) : [],
    };

    // Write maintenance file
    try {
      writeFileSync(maintenanceFile, JSON.stringify(payload, null, 2));
      
      console.log();
      console.log(pc.bgYellow(pc.black(' MAINTENANCE MODE ')));
      console.log();
      console.log(pc.yellow('Application is now in maintenance mode.'));
      console.log();
      
      if (payload.message !== 'Service Unavailable') {
        console.log(pc.dim(`Message: ${payload.message}`));
      }
      
      if (payload.secret) {
        console.log(pc.dim(`Secret bypass: ${payload.secret}`));
        console.log(pc.dim(`Access via: ${pc.cyan(`?_maintenance_secret=${payload.secret}`)}`));
      }
      
      if (payload.retry) {
        console.log(pc.dim(`Retry-After: ${payload.retry}s`));
      }
      
      if (payload.redirect) {
        console.log(pc.dim(`Redirect to: ${payload.redirect}`));
      }

      if (payload.except.length > 0) {
        console.log(pc.dim(`Excepted URIs: ${payload.except.join(', ')}`));
      }
      
      console.log();
      console.log(pc.dim(`Run ${pc.cyan('canx up')} to bring the application back online.`));
    } catch (error) {
      console.error(pc.red('Failed to enter maintenance mode:'), error);
    }
  }
}
