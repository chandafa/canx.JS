"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListCommand = void 0;
const index_1 = require("../index");
class ListCommand {
    signature = 'list';
    description = 'List all available commands';
    async handle() {
        index_1.cli.showHelp();
    }
}
exports.ListCommand = ListCommand;
