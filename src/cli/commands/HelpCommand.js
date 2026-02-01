"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelpCommand = void 0;
const index_1 = require("../index");
class HelpCommand {
    signature = 'help [command]';
    description = 'Display help for a command';
    async handle(args) {
        // If specific command requested?
        // For now, just show global help.
        // In future, show specific command help.
        index_1.cli.showHelp();
    }
}
exports.HelpCommand = HelpCommand;
