"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cli = exports.Console = void 0;
const picocolors_1 = __importDefault(require("picocolors"));
// Core Commands
const MigrateCommand_1 = require("./commands/MigrateCommand");
const QueueWorkCommand_1 = require("./commands/QueueWorkCommand");
const MakeCommand_1 = require("./commands/MakeCommand");
const RouteListCommand_1 = require("./commands/RouteListCommand");
const TestCommand_1 = require("./commands/TestCommand");
const ScheduleRunCommand_1 = require("./commands/ScheduleRunCommand");
const OptimizeCommand_1 = require("./commands/OptimizeCommand");
const Dashboard_1 = require("./commands/Dashboard");
const HelpCommand_1 = require("./commands/HelpCommand");
const ListCommand_1 = require("./commands/ListCommand");
class Console {
    commands = new Map();
    constructor() {
        // Core
        this.register(new HelpCommand_1.HelpCommand());
        this.register(new ListCommand_1.ListCommand());
        this.register(new MigrateCommand_1.MigrateCommand());
        this.register(new QueueWorkCommand_1.QueueWorkCommand());
        this.register(new Dashboard_1.DashboardCommand());
        this.register(new RouteListCommand_1.RouteListCommand());
        this.register(new TestCommand_1.TestCommand());
        this.register(new ScheduleRunCommand_1.ScheduleRunCommand());
        this.register(new OptimizeCommand_1.OptimizeCommand());
        // Generators
        this.register(new MakeCommand_1.MakeGenerator('controller'));
        this.register(new MakeCommand_1.MakeGenerator('model'));
        this.register(new MakeCommand_1.MakeGenerator('middleware'));
        this.register(new MakeCommand_1.MakeGenerator('migration'));
        this.register(new MakeCommand_1.MakeGenerator('seeder'));
        this.register(new MakeCommand_1.MakeGenerator('request'));
        this.register(new MakeCommand_1.MakeGenerator('resource'));
        this.register(new MakeCommand_1.MakeGenerator('policy'));
        this.register(new MakeCommand_1.MakeGenerator('service'));
        this.register(new MakeCommand_1.MakeGenerator('event'));
        this.register(new MakeCommand_1.MakeGenerator('job'));
        this.register(new MakeCommand_1.MakeGenerator('notification'));
        this.register(new MakeCommand_1.MakeGenerator('mail'));
        // New Generators
        this.register(new MakeCommand_1.MakeGenerator('action'));
        this.register(new MakeCommand_1.MakeGenerator('dto'));
        this.register(new MakeCommand_1.MakeGenerator('provider'));
        this.register(new MakeCommand_1.MakeGenerator('command'));
    }
    register(command) {
        const name = command.signature.split(' ')[0];
        this.commands.set(name, command);
    }
    async run(args) {
        const commandName = args[0];
        if (!commandName || commandName === '-h' || commandName === '--help') {
            this.showHelp();
            return;
        }
        const command = this.commands.get(commandName);
        if (!command) {
            // Suggest closest match?
            console.error(picocolors_1.default.red(`Command "${commandName}" not found.`));
            console.log(`Run ${picocolors_1.default.cyan('canx list')} to view available commands.`);
            return;
        }
        // Simple flag parser
        const params = args.slice(1);
        const flags = {};
        const commandArgs = [];
        for (const arg of params) {
            if (arg.startsWith('--')) {
                const [key, val] = arg.slice(2).split('=');
                flags[key] = val || true;
            }
            else if (arg.startsWith('-')) {
                flags[arg.slice(1)] = true;
            }
            else {
                commandArgs.push(arg);
            }
        }
        try {
            await command.handle(commandArgs, flags);
        }
        catch (e) {
            console.error(picocolors_1.default.red(`Error: ${e.message}`));
            process.exit(1);
        }
    }
    showHelp() {
        console.log(picocolors_1.default.green(`\nCanxJS CLI\n`));
        console.log(picocolors_1.default.yellow(`Usage:`));
        console.log(`  canx <command> [options]\n`);
        // Group commands
        const groups = {};
        const others = [];
        // Unique commands to avoid generator duplication if they register multiple names (MakeCommand serves multiple)
        // MakeGenerator registers unique names (make:controller, make:model), so it's fine.
        const sortedCommands = Array.from(this.commands.values()).sort((a, b) => a.signature.localeCompare(b.signature));
        for (const cmd of sortedCommands) {
            const name = cmd.signature.split(' ')[0];
            if (name.includes(':')) {
                const prefix = name.split(':')[0];
                if (!groups[prefix])
                    groups[prefix] = [];
                groups[prefix].push(cmd);
            }
            else {
                others.push(cmd);
            }
        }
        if (others.length > 0) {
            console.log(picocolors_1.default.yellow('Available commands:'));
            for (const cmd of others) {
                console.log(`  ${picocolors_1.default.cyan(cmd.signature.split(' ')[0].padEnd(25))} ${cmd.description}`);
            }
        }
        for (const [prefix, cmds] of Object.entries(groups)) {
            console.log(picocolors_1.default.yellow(`\n ${prefix}`));
            for (const cmd of cmds) {
                console.log(`  ${picocolors_1.default.cyan(cmd.signature.split(' ')[0].padEnd(25))} ${cmd.description}`);
            }
        }
        console.log('');
    }
}
exports.Console = Console;
exports.cli = new Console();
