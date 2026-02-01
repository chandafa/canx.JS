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
exports.MigrateCommand = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const picocolors_1 = __importDefault(require("picocolors"));
const Migration_1 = require("../../database/Migration");
const Model_1 = require("../../mvc/Model");
class MigrateCommand {
    signature = 'migrate [action]';
    description = 'Run database migrations. Actions: run (default), rollback, fresh, status';
    async handle(args, flags) {
        const action = args[0] || 'run';
        const cwd = process.cwd();
        // 1. Load Database Config
        const configPath = (0, path_1.join)(cwd, 'src/config/database.ts');
        const jsConfigPath = (0, path_1.join)(cwd, 'src/config/database.js');
        let dbConfig;
        try {
            if ((0, fs_1.existsSync)(configPath)) {
                const module = await Promise.resolve(`${configPath}`).then(s => __importStar(require(s)));
                dbConfig = module.default;
            }
            else if ((0, fs_1.existsSync)(jsConfigPath)) {
                const module = await Promise.resolve(`${jsConfigPath}`).then(s => __importStar(require(s)));
                dbConfig = module.default;
            }
            else {
                console.error(picocolors_1.default.red('Config file src/config/database.{ts,js} not found.'));
                return;
            }
        }
        catch (e) {
            console.error(picocolors_1.default.red('Failed to load database config:'), e);
            return;
        }
        // 2. Initialize Database
        try {
            await (0, Model_1.initDatabase)(dbConfig);
        }
        catch (e) {
            console.error(picocolors_1.default.red(`Database connection failed: ${e.message}`));
            return;
        }
        // 3. Load Migrations
        const migrationDir = (0, path_1.join)(cwd, 'src/database/migrations');
        if (!(0, fs_1.existsSync)(migrationDir)) {
            console.log(picocolors_1.default.yellow('No migrations directory found at src/database/migrations.'));
            // We still run if we want to just check status or ensure table, but usually pointless.
            if (action !== 'status')
                return;
        }
        else {
            const files = (0, fs_1.readdirSync)(migrationDir)
                .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
                .sort(); // Sort by name (timestamp)
            if (files.length === 0) {
                console.log(picocolors_1.default.yellow('No migration files found.'));
            }
            for (const file of files) {
                await Promise.resolve(`${(0, path_1.join)(migrationDir, file)}`).then(s => __importStar(require(s)));
            }
        }
        // 4. Run Action
        try {
            switch (action) {
                case 'run':
                    await Migration_1.migrator.run();
                    break;
                case 'rollback':
                    await Migration_1.migrator.rollback();
                    break;
                case 'fresh':
                    await Migration_1.migrator.fresh();
                    break;
                case 'reset':
                    await Migration_1.migrator.reset();
                    break;
                case 'status':
                    const status = await Migration_1.migrator.status();
                    console.table(status);
                    break;
                default:
                    console.error(picocolors_1.default.red(`Unknown action "${action}". Use run, rollback, fresh, reset, or status.`));
            }
        }
        catch (e) {
            console.error(picocolors_1.default.red(`Migration failed:`), e);
        }
        process.exit(0);
    }
}
exports.MigrateCommand = MigrateCommand;
