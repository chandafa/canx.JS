"use strict";
/**
 * CanxJS - Main Application Class
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Canx = void 0;
exports.createApp = createApp;
exports.defineConfig = defineConfig;
const Server_1 = require("./core/Server");
const Router_1 = require("./core/Router");
const Middleware_1 = require("./core/Middleware");
const Controller_1 = require("./mvc/Controller");
const Container_1 = require("./container/Container");
class Canx {
    config;
    router;
    server = null;
    pipeline;
    plugins = [];
    constructor(config = {}) {
        this.config = {
            port: 3000,
            hostname: '0.0.0.0',
            development: process.env.NODE_ENV !== 'production',
            ...config,
        };
        this.router = (0, Router_1.createRouter)();
        // Bind Router to Container for global helpers
        // Bind Router to Container for global helpers
        Container_1.container.instance('Router', this.router);
        this.pipeline = new Middleware_1.MiddlewarePipeline();
    }
    /**
     * Register global middleware
     */
    use(middleware) {
        this.pipeline.use(middleware);
        return this;
    }
    /**
     * Register routes
     */
    routes(callback) {
        callback(this.router);
        return this;
    }
    /**
     * Register controller
     */
    controller(ControllerClass) {
        const instance = new ControllerClass();
        const meta = (0, Controller_1.getControllerMeta)(instance);
        meta.routes.forEach((routeInfo, methodName) => {
            const path = meta.prefix + routeInfo.path;
            const handler = async (req, res) => {
                instance.setContext(req, res);
                return instance[methodName](req, res);
            };
            const method = routeInfo.method.toLowerCase();
            if (typeof this.router[method] === 'function') {
                this.router[method](path, ...routeInfo.middlewares, handler);
            }
        });
        return this;
    }
    /**
     * Register plugin
     */
    plugin(plugin) {
        this.plugins.push(plugin);
        return this;
    }
    /**
     * Start the server
     */
    async listen(port, callback) {
        if (typeof port === 'function') {
            callback = port;
            port = undefined;
        }
        if (port && typeof port === 'number') {
            this.config.port = port;
        }
        // Initialize plugins
        for (const plugin of this.plugins) {
            await plugin.install(this);
        }
        // Start Scheduler
        const { scheduler } = await Promise.resolve().then(() => __importStar(require('./features/Scheduler')));
        scheduler.start();
        this.server = new Server_1.Server(this.config, (req) => this.handle(req));
        await this.server.listen(callback);
    }
    /**
     * Handle a raw request (internal or for testing)
     */
    async handle(rawReq) {
        const req = (0, Server_1.createCanxRequest)(rawReq);
        const res = (0, Server_1.createCanxResponse)();
        try {
            // Match route
            const match = this.router.match(req.method, req.path);
            if (!match) {
                const { NotFoundException } = await Promise.resolve().then(() => __importStar(require('./core/exceptions/NotFoundException')));
                throw new NotFoundException(`Route not found: ${req.method} ${req.path}`);
            }
            // Update params
            Object.assign(req.params, match.params);
            // Execute middleware pipeline and handler
            const result = await this.pipeline.execute(req, res, match.middlewares, () => match.handler(req, res));
            // If handler returns string (e.g., from View()), wrap in HTML Response
            if (typeof result === 'string') {
                return res.html(result);
            }
            // If result is already a Response, return it
            if (result instanceof Response) {
                return result;
            }
            // If result is an object/array, return as JSON
            if (result !== null && result !== undefined) {
                return res.json(result);
            }
            // Fallback: empty 204 response
            return res.empty();
        }
        catch (error) {
            // Delegate to ErrorHandler (via Server.ts or manual call here if needed)
            // Since Server.ts calls this method, allowing it to bubble up is usually fine.
            // However, if we want to ensure any internal pipelines are caught, we rethrow.
            throw error;
        }
    }
    /**
     * Stop the server
     */
    async close() {
        if (this.server) {
            await this.server.close();
            this.server = null;
            // Stop Scheduler
            const { scheduler } = await Promise.resolve().then(() => __importStar(require('./features/Scheduler')));
            scheduler.stop();
        }
    }
    /**
     * Get router for chaining
     */
    get(path, ...handlers) { this.router.get(path, ...handlers); return this; }
    post(path, ...handlers) { this.router.post(path, ...handlers); return this; }
    put(path, ...handlers) { this.router.put(path, ...handlers); return this; }
    patch(path, ...handlers) { this.router.patch(path, ...handlers); return this; }
    delete(path, ...handlers) { this.router.delete(path, ...handlers); return this; }
    all(path, ...handlers) { this.router.all(path, ...handlers); return this; }
    /**
     * Register a resource controller with RESTful routes
     */
    resource(path, controller, ...middlewares) {
        this.router.resource(path, controller, ...middlewares);
        return this;
    }
    /**
     * Group routes with a common prefix
     */
    group(prefix, callback) {
        this.router.group(prefix, callback);
        return this;
    }
    /**
     * Register routes under a versioned API path
     * @param version - Version identifier (e.g., 'v1', 'v2')
     * @param callback - Route registration callback
     */
    version(version, callback) {
        const prefix = version.startsWith('/') ? version : '/api/' + version;
        this.router.group(prefix, callback);
        return this;
    }
}
exports.Canx = Canx;
/**
 * Create a new CanxJS application instance
 */
function createApp(config) {
    return new Canx(config);
}
/**
 * Define configuration with type checking
 * Helper for creating typed configuration objects
 */
function defineConfig(config) {
    return config;
}
exports.default = Canx;
