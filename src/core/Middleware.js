"use strict";
/**
 * CanxJS Middleware - Async-first pipeline with error boundaries
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
exports.serveStatic = exports.compress = exports.rateLimit = exports.bodyParser = exports.logger = exports.cors = exports.MiddlewarePipeline = void 0;
exports.createMiddlewarePipeline = createMiddlewarePipeline;
const path = __importStar(require("node:path"));
class MiddlewarePipeline {
    middlewares = [];
    use(...handlers) {
        this.middlewares.push(...handlers);
        return this;
    }
    async execute(req, res, routeMiddlewares, finalHandler) {
        const allMiddlewares = [...this.middlewares, ...routeMiddlewares];
        let index = 0;
        const next = async () => {
            if (index >= allMiddlewares.length) {
                return finalHandler();
            }
            const middleware = allMiddlewares[index++];
            const result = await middleware(req, res, next);
            return result || undefined;
        };
        try {
            const result = await next();
            return result || new Response('No response', { status: 500 });
        }
        catch (error) {
            console.error('[CanxJS Middleware Error]', error);
            return new Response(JSON.stringify({
                error: error instanceof Error ? error.message : 'Internal Server Error'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }
}
exports.MiddlewarePipeline = MiddlewarePipeline;
// Built-in middlewares
const cors = (options = {}) => {
    return async (req, res, next) => {
        const origin = Array.isArray(options.origin) ? options.origin[0] : (options.origin || '*');
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', options.methods?.join(', ') || 'GET,POST,PUT,DELETE,OPTIONS');
        if (options.credentials)
            res.header('Access-Control-Allow-Credentials', 'true');
        return next();
    };
};
exports.cors = cors;
const logger = () => {
    return async (req, res, next) => {
        const start = performance.now();
        const result = await next();
        const duration = (performance.now() - start).toFixed(2);
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${duration}ms`);
        return result;
    };
};
exports.logger = logger;
const bodyParser = () => {
    return async (req, res, next) => {
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            await req.body();
        }
        return next();
    };
};
exports.bodyParser = bodyParser;
const rateLimit = (options = {}) => {
    const { windowMs = 60000, max = 100 } = options;
    const requests = new Map();
    return async (req, res, next) => {
        const ip = req.header('x-forwarded-for') || 'unknown';
        const now = Date.now();
        const record = requests.get(ip);
        if (!record || now > record.resetAt) {
            requests.set(ip, { count: 1, resetAt: now + windowMs });
        }
        else if (record.count >= max) {
            return res.status(429).json({ error: 'Too many requests' });
        }
        else {
            record.count++;
        }
        return next();
    };
};
exports.rateLimit = rateLimit;
const compress = () => {
    return async (req, res, next) => {
        const accept = req.header('accept-encoding') || '';
        if (accept.includes('gzip')) {
            res.header('Content-Encoding', 'gzip');
        }
        return next();
    };
};
exports.compress = compress;
/**
 * Serve static files from a directory
 * @param root - The root directory to serve files from (relative to cwd or absolute)
 * @param options - Configuration options
 */
const serveStatic = (root = 'public', options = {}) => {
    const { index = 'index.html', maxAge = 86400 } = options;
    const rootPath = path.isAbsolute(root) ? root : path.join(process.cwd(), root);
    const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.pdf': 'application/pdf',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.txt': 'text/plain',
        '.xml': 'application/xml',
    };
    return async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }
        // Clean the path to prevent directory traversal
        const cleanPath = req.path.replace(/\.\./g, '').replace(/\/+/g, '/');
        let filePath = path.join(rootPath, cleanPath);
        try {
            let file = Bun.file(filePath);
            // Check if it's a directory by trying index file
            if (!(await file.exists())) {
                file = Bun.file(path.join(filePath, index));
                if (!(await file.exists())) {
                    return next();
                }
                filePath = path.join(filePath, index);
            }
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            return new Response(file, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': `public, max-age=${maxAge}`,
                    'Content-Length': String(file.size),
                },
            });
        }
        catch (e) {
            // File not found, continue to next middleware
        }
        return next();
    };
};
exports.serveStatic = serveStatic;
function createMiddlewarePipeline() {
    return new MiddlewarePipeline();
}
exports.default = MiddlewarePipeline;
