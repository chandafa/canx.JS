"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueWorkCommand = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const picocolors_1 = __importDefault(require("picocolors"));
const Queue_1 = require("../../queue/Queue");
class QueueWorkCommand {
    signature = 'queue:work';
    description = 'Start the queue worker';
    async handle(args, flags) {
        const cwd = process.cwd();
        // 1. Load Config (Optional, logic in Queue.ts handles defaults)
        // But if user has config, we might want to load it.
        // Actually Queue is singleton. If app hasn't started, Queue needs config.
        const configPath = (0, path_1.join)(cwd, 'src/config/queue.ts');
        if ((0, fs_1.existsSync)(configPath)) {
            try {
                const module = await Promise.resolve(`${configPath}`).then(s => __importStar(require(s)));
                // Assuming config exports default object or similar.
                // But Queue singleton is already instantiated.
                // We might need a reconfigure method or just assume config sets the driver on the singleton if it imports it.
                // But user config usually exports a simple object.
                // We'll leave this for now. The framework should probably auto-load config in a simpler way.
            }
            catch (e) {
                console.error(picocolors_1.default.red('Failed to load queue config'), e);
            }
        }
        // 2. Load Jobs
        const jobsDir = (0, path_1.join)(cwd, 'src/queue/jobs');
        if ((0, fs_1.existsSync)(jobsDir)) {
            const files = (0, fs_1.readdirSync)(jobsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
            console.log(picocolors_1.default.blue(`[Queue] Loading ${files.length} job definitions...`));
            for (const file of files) {
                await Promise.resolve(`${(0, path_1.join)(jobsDir, file)}`).then(s => __importStar(require(s)));
            }
        }
        else {
            console.warn(picocolors_1.default.yellow('[Queue] No jobs directory found at src/queue/jobs'));
        }
        // 3. Start
        console.log(picocolors_1.default.green('[Queue] Starting worker...'));
        Queue_1.queue.start();
        // Keep alive? Queue.start() might be async or just setup timers.
        // Queue.ts start() sets running=true and calls process() which sets timeouts.
        // Node process won't exit if there are active timeouts.
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log(picocolors_1.default.yellow('\n[Queue] Stopping...'));
            Queue_1.queue.stop();
            process.exit(0);
        });
    }
}
exports.QueueWorkCommand = QueueWorkCommand;
