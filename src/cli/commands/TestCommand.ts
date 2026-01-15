import { spawn } from 'child_process';
import type { Command } from '../Command';

export class TestCommand implements Command {
  signature = 'test';
  description = 'Run application tests';

  async handle(args: string[], flags: Record<string, any>) {
    // Simply proxy to 'bun test'
    // Pass specific arguments if provided
    
    const bunArgs = ['test', ...args];
    
    const child = spawn('bun', bunArgs, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code !== 0) {
        process.exit(code || 1);
      }
    });
  }
}
