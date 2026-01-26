
import type { Command } from '../Command';
import { cli } from '../index';

export class HelpCommand implements Command {
  signature = 'help [command]';
  description = 'Display help for a command';

  async handle(args: string[]) {
      // If specific command requested?
      // For now, just show global help.
      // In future, show specific command help.
      cli.showHelp();
  }
}
