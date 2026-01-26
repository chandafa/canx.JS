
import type { Command } from '../Command';
import { cli } from '../index';

export class ListCommand implements Command {
  signature = 'list';
  description = 'List all available commands';

  async handle() {
      cli.showHelp();
  }
}
