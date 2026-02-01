"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestCommand = void 0;
const child_process_1 = require("child_process");
class TestCommand {
    signature = 'test';
    description = 'Run application tests';
    async handle(args, flags) {
        // Simply proxy to 'bun test'
        // Pass specific arguments if provided
        const bunArgs = ['test', ...args];
        const child = (0, child_process_1.spawn)('bun', bunArgs, {
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
exports.TestCommand = TestCommand;
