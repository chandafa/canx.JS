import pc from 'picocolors';
import type { Command } from './Command';
export type { Command };

// Core Commands
import { MigrateCommand } from './commands/MigrateCommand';
import { QueueWorkCommand } from './commands/QueueWorkCommand';
import { MakeGenerator } from './commands/MakeCommand';
import { RouteListCommand } from './commands/RouteListCommand';
import { TestCommand } from './commands/TestCommand';
import { ScheduleRunCommand } from './commands/ScheduleRunCommand';
import { OptimizeCommand } from './commands/OptimizeCommand';
import { DashboardCommand } from './commands/Dashboard';
import { HelpCommand } from './commands/HelpCommand';
import { ListCommand } from './commands/ListCommand';
import { TinkerCommand } from './commands/TinkerCommand';
import { MakeCrudCommand } from './commands/MakeCrudCommand';
import { DownCommand } from './commands/DownCommand';
import { UpCommand } from './commands/UpCommand';

export class Console {
  private commands: Map<string, Command> = new Map();

  constructor() {
      // Core
      this.register(new HelpCommand());
      this.register(new ListCommand());
      this.register(new MigrateCommand());
      this.register(new QueueWorkCommand());
      this.register(new DashboardCommand());
      this.register(new RouteListCommand());
      this.register(new TestCommand());
      this.register(new ScheduleRunCommand());
      this.register(new OptimizeCommand());
      this.register(new TinkerCommand());
      this.register(new DownCommand());
      this.register(new UpCommand());
      
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
      
      // New Generators
      this.register(new MakeGenerator('action'));
      this.register(new MakeGenerator('dto'));
      this.register(new MakeGenerator('provider'));
      this.register(new MakeGenerator('command'));
      this.register(new MakeGenerator('microservice'));
      this.register(new MakeGenerator('cqrs-command'));
      this.register(new MakeGenerator('cqrs-handler'));
      
      // Bundles
      this.register(new MakeCrudCommand());
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
      // Suggest closest match?
      console.error(pc.red(`Command "${commandName}" not found.`));
      console.log(`Run ${pc.cyan('canx list')} to view available commands.`);
      return;
    }

    // Simple flag parser
    const params = args.slice(1);
    const flags: Record<string, any> = {};
    const commandArgs: string[] = [];

    // Enhanced flag parser to support space-separated flags (--flag value)
    for (let i = 0; i < params.length; i++) {
        const arg = params[i];
        
        if (arg.startsWith('--')) {
            // Case: --flag or --flag=value
            if (arg.includes('=')) {
                const [key, val] = arg.slice(2).split('=');
                flags[key] = val;
            } else {
                // Case: --flag value OR --flag (boolean)
                const key = arg.slice(2);
                const nextArg = params[i + 1];
                
                // If next arg exists and is NOT a flag, consume it as value
                if (nextArg && !nextArg.startsWith('-')) {
                    flags[key] = nextArg;
                    i++; // Skip next arg
                } else {
                    flags[key] = true;
                }
            }
        } else if (arg.startsWith('-')) {
             // Short flag -x
             flags[arg.slice(1)] = true;
        } else {
             // Positional arg
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
    
    // Group commands
    const groups: Record<string, Command[]> = {};
    const others: Command[] = [];

    // Unique commands to avoid generator duplication if they register multiple names (MakeCommand serves multiple)
    // MakeGenerator registers unique names (make:controller, make:model), so it's fine.
    
    const sortedCommands = Array.from(this.commands.values()).sort((a, b) => 
        a.signature.localeCompare(b.signature)
    );

    for (const cmd of sortedCommands) {
        const name = cmd.signature.split(' ')[0];
        if (name.includes(':')) {
            const prefix = name.split(':')[0];
            if (!groups[prefix]) groups[prefix] = [];
            groups[prefix].push(cmd);
        } else {
            others.push(cmd);
        }
    }

    if (others.length > 0) {
        console.log(pc.yellow('Available commands:'));
        for (const cmd of others) {
            console.log(`  ${pc.cyan(cmd.signature.split(' ')[0].padEnd(25))} ${cmd.description}`);
        }
    }

    for (const [prefix, cmds] of Object.entries(groups)) {
        console.log(pc.yellow(`\n ${prefix}`));
        for (const cmd of cmds) {
            console.log(`  ${pc.cyan(cmd.signature.split(' ')[0].padEnd(25))} ${cmd.description}`);
        }
    }
    console.log('');
  }
}

export const cli = new Console();
