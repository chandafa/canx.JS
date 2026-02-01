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
exports.RouteListCommand = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const picocolors_1 = __importDefault(require("picocolors"));
class RouteListCommand {
    signature = 'route:list';
    description = 'List all registered routes';
    async handle(args, flags) {
        const cwd = process.cwd();
        // Try to find the app entry point
        const candidates = [
            'src/server.ts', 'server.ts',
            'src/index.ts', 'index.ts',
            'src/main.ts', 'main.ts',
            'src/app.ts', 'app.ts'
        ];
        let app = null;
        let loadedFile = '';
        for (const file of candidates) {
            const fullPath = (0, path_1.join)(cwd, file);
            if ((0, fs_1.existsSync)(fullPath)) {
                try {
                    const mod = await Promise.resolve(`${fullPath}`).then(s => __importStar(require(s)));
                    // Check for 'app' or default export that looks like Canx
                    if (mod.app && mod.app.router) {
                        app = mod.app;
                    }
                    else if (mod.default && mod.default.router) {
                        app = mod.default;
                    }
                    if (app) {
                        loadedFile = file;
                        break;
                    }
                }
                catch (e) {
                    // Ignore import errors, try next
                    // console.error(e);
                }
            }
        }
        if (!app) {
            console.error(picocolors_1.default.red('Could not find Canx application instance.'));
            console.error(picocolors_1.default.yellow('Make sure your entry file (e.g., src/server.ts) exports the "app" instance.'));
            return;
        }
        console.log(picocolors_1.default.gray(`Loaded application from ${loadedFile}`));
        const routes = app.router.getRoutes();
        if (routes.length === 0) {
            console.warn(picocolors_1.default.yellow('No routes registered.'));
            return;
        }
        console.log('\n' + picocolors_1.default.bold('Registered Routes:'));
        console.log('------------------------------------------------------------');
        // Calculate padding
        const methodPad = 8;
        const pathPad = 50;
        routes.forEach(route => {
            let method = route.method.toUpperCase();
            const color = this.getMethodColor(method);
            console.log(color(method.padEnd(methodPad)) +
                picocolors_1.default.white(route.path.padEnd(pathPad)) +
                picocolors_1.default.gray(`[Middlewares: ${(route.middlewares || []).length}]`));
        });
        console.log('------------------------------------------------------------\n');
    }
    getMethodColor(method) {
        switch (method) {
            case 'GET': return picocolors_1.default.blue;
            case 'POST': return picocolors_1.default.yellow;
            case 'PUT': return picocolors_1.default.cyan;
            case 'DELETE': return picocolors_1.default.red;
            default: return picocolors_1.default.white;
        }
    }
}
exports.RouteListCommand = RouteListCommand;
