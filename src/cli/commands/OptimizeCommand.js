"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizeCommand = void 0;
const AutoCache_1 = require("../../features/AutoCache");
const picocolors_1 = __importDefault(require("picocolors"));
class OptimizeCommand {
    signature = 'optimize';
    description = 'Optimize the framework (clear caches, etc)';
    async handle() {
        console.log(picocolors_1.default.blue('Optimizing CanxJS...'));
        // Clear AutoCache
        AutoCache_1.autoCache.clear();
        console.log(picocolors_1.default.green('✔ AutoCache cleared'));
        // In the future: Compile routes, cache config, etc.
        console.log(picocolors_1.default.green('Optimization completed successfully.'));
    }
}
exports.OptimizeCommand = OptimizeCommand;
