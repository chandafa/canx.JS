import pc from 'picocolors';
import type { Command } from './Command';

// Core Commands
import { MigrateCommand } from './commands/MigrateCommand';
import { QueueWorkCommand } from './commands/QueueWorkCommand';
import { MakeGenerator } from './commands/MakeCommand';
import { RouteListCommand } from './commands/RouteListCommand';
import { TestCommand } from './commands/TestCommand';
import { ScheduleRunCommand } from './commands/ScheduleRunCommand';
import { OptimizeCommand } from './commands/OptimizeCommand';

export class Console {
  private commands: Map<string, Command> = new Map();

  constructor() {
      // Core
      this.register(new MigrateCommand());
      this.register(new QueueWorkCommand());
      this.register(new RouteListCommand());
      this.register(new TestCommand());
      this.register(new ScheduleRunCommand());
      this.register(new OptimizeCommand());
      
      // Generators
      this.register(new MakeGenerator('controller'));
      this.register(new MakeGenerator('model'));
      this.register(new MakeGenerator('middleware'));
      this.register(new MakeGenerator('migration'));
      this.register(new MakeGenerator('seeder'));
      this.register(new MakeGenerator('request'));
      this.register(new MakeGenerator('resource'));
      this.register(new MakeGenerator('policy'));
      this.register(new MakeGenerator('service'));
      this.register(new MakeGenerator('event'));
      this.register(new MakeGenerator('job'));
      this.register(new MakeGenerator('notification'));
      this.register(new MakeGenerator('mail'));
    }

  register(command: Command) {
    const name = command.signature.split(' ')[0];
    this.commands.set(name, command);
  }

  async run(args: string[]) {
    const commandName = args[0];
    
    if (!commandName || commandName === '-h' || commandName === '--help') {
      this.showHelp();
      return;
    }

    const command = this.commands.get(commandName);
    if (!command) {
      console.error(pc.red(`Command "${commandName}" not found.`));
      return;
    }

    // Simple flag parser
    const params = args.slice(1);
    const flags: Record<string, any> = {};
    const commandArgs: string[] = [];

    for (const arg of params) {
      if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        flags[key] = val || true;
      } else if (arg.startsWith('-')) {
         flags[arg.slice(1)] = true;
      } else {
        commandArgs.push(arg);
      }
    }

    try {
      await command.handle(commandArgs, flags);
    } catch (e: any) {
      console.error(pc.red(`Error: ${e.message}`));
      process.exit(1);
    }
  }

  showHelp() {
    console.log(pc.green(`\nCanxJS CLI\n`));
    console.log(pc.yellow(`Usage:`));
    console.log(`  canx <command> [options]\n`);
    console.log(pc.yellow(`Available Commands:`));
    
    // Group by namespace if needed, simplified for now
    for (const [name, cmd] of this.commands) {
      console.log(`  ${pc.cyan(cmd.signature.padEnd(25))} ${cmd.description}`);
    }
    console.log('');
  }
}

export const cli = new Console();
