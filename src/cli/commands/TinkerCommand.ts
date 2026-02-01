import repl from 'repl';
import type { Command } from '../Command';
import { ApplicationKernel } from '../../core/ServiceProvider';
import * as Canx from '../../index';
import { container } from '../../container/Container';

export class TinkerCommand implements Command {
  signature = 'tinker';
  description = 'Interact with your application';

  async handle(args: string[], flags: Record<string, any>) {
    console.log('Loading CanxJS environment...');
    
    // Check if we are in a project
    const cwd = process.cwd();
    
    // Try to boot the app
    try {
        const kernel = new ApplicationKernel();

        await kernel.boot();
        console.log('Application booted.');

        const r = repl.start('>>> ');

        // Expose everything from CanxJS core
        Object.assign(r.context, Canx);
        
        // Expose container
        r.context.app = container;
        
        // Helper to reload
        r.context.reload = async () => {
            console.log('Reloading...');
            // In a real app we might clear require cache here
        };

        // Handle exit
        r.on('exit', () => {
            process.exit();
        });

    } catch (e: any) {
        console.error('Failed to boot application:', e.message);
    }
  }
}
