"use strict";
/**
 * CanxJS HTTP/2 Support
 * HTTP/2 server with push, streams, and multiplexing
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
exports.Http2Server = void 0;
exports.createHttp2Middleware = createHttp2Middleware;
exports.createHttp2Server = createHttp2Server;
exports.startHttp2 = startHttp2;
// ============================================
// HTTP/2 Server
// ============================================
class Http2Server {
    options;
    server = null;
    handlers = new Map();
    constructor(options = {}) {
        this.options = {
            port: 443,
            host: 'localhost',
            allowHTTP1: true,
            maxConcurrentStreams: 100,
            enablePush: true,
            sessionTimeout: 30000,
            ...options,
        };
        // Initialize method maps
        for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
            this.handlers.set(method, new Map());
        }
    }
    /**
     * Register a GET handler
     */
    get(path, handler) {
        this.handlers.get('GET').set(path, handler);
        return this;
    }
    /**
     * Register a POST handler
     */
    post(path, handler) {
        this.handlers.get('POST').set(path, handler);
        return this;
    }
    /**
     * Register a PUT handler
     */
    put(path, handler) {
        this.handlers.get('PUT').set(path, handler);
        return this;
    }
    /**
     * Register a PATCH handler
     */
    patch(path, handler) {
        this.handlers.get('PATCH').set(path, handler);
        return this;
    }
    /**
     * Register a DELETE handler
     */
    delete(path, handler) {
        this.handlers.get('DELETE').set(path, handler);
        return this;
    }
    /**
     * Start the HTTP/2 server
     */
    async start() {
        const http2 = await Promise.resolve().then(() => __importStar(require('node:http2')));
        const fs = await Promise.resolve().then(() => __importStar(require('node:fs')));
        let serverOptions = {
            allowHTTP1: this.options.allowHTTP1,
        };
        // Load SSL certificates
        if (this.options.certContent && this.options.keyContent) {
            serverOptions.cert = this.options.certContent;
            serverOptions.key = this.options.keyContent;
        }
        else if (this.options.cert && this.options.key) {
            serverOptions.cert = fs.readFileSync(this.options.cert);
            serverOptions.key = fs.readFileSync(this.options.key);
        }
        else {
            // Generate self-signed cert for development
            console.warn('No SSL certificate provided. Using insecure HTTP/2 (h2c) - not recommended for production.');
            this.server = http2.createServer();
        }
        if (!this.server) {
            this.server = http2.createSecureServer(serverOptions);
        }
        // Set session options
        this.server.on('session', (session) => {
            session.setTimeout(this.options.sessionTimeout);
            if (this.options.maxConcurrentStreams) {
                session.settings({ maxConcurrentStreams: this.options.maxConcurrentStreams });
            }
        });
        // Handle streams
        this.server.on('stream', async (stream, headers) => {
            const method = headers[':method'];
            const path = headers[':path'];
            try {
                await this.handleRequest(stream, headers, method, path);
            }
            catch (error) {
                console.error('HTTP/2 Error:', error);
                stream.respond({ ':status': 500 });
                stream.end(JSON.stringify({ error: error.message }));
            }
        });
        // Handle errors
        this.server.on('error', (error) => {
            console.error('HTTP/2 Server Error:', error);
        });
        return new Promise((resolve) => {
            this.server.listen(this.options.port, this.options.host, () => {
                console.log(`🚀 HTTP/2 server running on https://${this.options.host}:${this.options.port}`);
                resolve();
            });
        });
    }
    /**
     * Stop the server
     */
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('HTTP/2 server stopped');
                    resolve();
                });
            });
        }
    }
    /**
     * Handle an incoming request
     */
    async handleRequest(stream, headers, method, path) {
        const methodHandlers = this.handlers.get(method.toUpperCase());
        if (!methodHandlers) {
            stream.respond({ ':status': 405 });
            stream.end('Method Not Allowed');
            return;
        }
        // Find matching handler
        let handler;
        let params = {};
        for (const [pattern, h] of methodHandlers) {
            const match = this.matchPath(pattern, path);
            if (match) {
                handler = h;
                params = match.params;
                break;
            }
        }
        if (!handler) {
            stream.respond({ ':status': 404 });
            stream.end('Not Found');
            return;
        }
        // Create request object
        const req = this.createRequest(stream, headers, method, path, params);
        // Create response object
        const res = this.createResponse(stream);
        // Execute handler
        await handler(req, res, () => Promise.resolve());
    }
    /**
     * Match path pattern
     */
    matchPath(pattern, path) {
        const patternParts = pattern.split('/');
        const pathParts = path.split('?')[0].split('/');
        if (patternParts.length !== pathParts.length && !pattern.endsWith('*')) {
            return null;
        }
        const params = {};
        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathPart = pathParts[i];
            if (patternPart.startsWith(':')) {
                params[patternPart.slice(1)] = pathPart;
            }
            else if (patternPart === '*') {
                // Wildcard matches rest
                break;
            }
            else if (patternPart !== pathPart) {
                return null;
            }
        }
        return { params };
    }
    /**
     * Create request object
     */
    createRequest(stream, headers, method, path, params) {
        const url = new URL(path, `https://${headers[':authority']}`);
        return {
            raw: new Request(url.toString(), {
                method,
                headers: headers,
            }), // Stub raw request for compatibility
            method: method,
            path,
            url: path,
            params,
            query: Object.fromEntries(url.searchParams),
            headers: new Headers(headers),
            body: async () => {
                // Default body reader
                return new Promise((resolve, reject) => {
                    let data = '';
                    stream.on('data', (chunk) => { data += chunk.toString(); });
                    stream.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        }
                        catch {
                            resolve(data);
                        }
                    });
                    stream.on('error', reject);
                });
            },
            json: async () => {
                return new Promise((resolve, reject) => {
                    let data = '';
                    stream.on('data', (chunk) => { data += chunk.toString(); });
                    stream.on('end', () => {
                        try {
                            resolve(data ? JSON.parse(data) : {});
                        }
                        catch {
                            resolve({});
                        }
                    });
                    stream.on('error', reject);
                });
            },
            text: async () => {
                return new Promise((resolve, reject) => {
                    let data = '';
                    stream.on('data', (chunk) => { data += chunk.toString(); });
                    stream.on('end', () => resolve(data));
                    stream.on('error', reject);
                });
            },
            formData: async () => {
                // Basic placeholder - HTTP/2 form data parsing is complex without external lib
                return new FormData();
            },
            arrayBuffer: async () => {
                return new Promise((resolve, reject) => {
                    const chunks = [];
                    stream.on('data', (chunk) => chunks.push(chunk));
                    stream.on('end', () => resolve(Buffer.concat(chunks).buffer));
                    stream.on('error', reject);
                });
            },
            files: async () => new Map(), // Placeholder
            header: (name) => headers[name.toLowerCase()] || null,
            cookie: (name) => {
                const cookieHeader = headers['cookie'];
                if (!cookieHeader)
                    return undefined;
                const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
                    const [k, v] = cookie.trim().split('=');
                    acc[k] = v;
                    return acc;
                }, {});
                return cookies[name];
            },
            context: new Map(),
            timestamp: Date.now(),
            id: crypto.randomUUID(),
            user: undefined,
            session: undefined,
        };
    }
    /**
     * Create response object
     */
    createResponse(stream) {
        let statusCode = 200;
        const responseHeaders = {};
        let headersWritten = false;
        const writeHeaders = () => {
            if (!headersWritten) {
                stream.respond({
                    ':status': statusCode,
                    ...responseHeaders,
                });
                headersWritten = true;
            }
        };
        return {
            status: (code) => {
                statusCode = code;
                return res;
            },
            header: (key, value) => {
                responseHeaders[key.toLowerCase()] = value;
                return res;
            },
            json: (data) => {
                responseHeaders['content-type'] = 'application/json';
                writeHeaders();
                stream.end(JSON.stringify(data));
                return res;
            },
            html: (html) => {
                responseHeaders['content-type'] = 'text/html; charset=utf-8';
                writeHeaders();
                stream.end(html);
                return res;
            },
            text: (text) => {
                responseHeaders['content-type'] = 'text/plain; charset=utf-8';
                writeHeaders();
                stream.end(text);
                return res;
            },
            send: (data) => {
                writeHeaders();
                stream.end(data);
                return res;
            },
            // HTTP/2 Server Push
            push: async (options) => {
                if (!stream.pushAllowed) {
                    console.warn('Server push not allowed by client');
                    return res;
                }
                return new Promise((resolve, reject) => {
                    stream.pushStream({ ':path': options.path, ...options.headers }, (err, pushStream) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        pushStream.respond({ ':status': 200 });
                        if (options.content) {
                            pushStream.end(options.content);
                        }
                        else {
                            pushStream.end();
                        }
                        resolve(res);
                    });
                });
            },
        };
        const res = arguments[0];
    }
}
exports.Http2Server = Http2Server;
// ============================================
// HTTP/2 Middleware Wrapper
// ============================================
function createHttp2Middleware(handler) {
    return async (stream, headers) => {
        // This allows using existing CanxJS handlers with HTTP/2
        // Implementation would wrap stream/headers into req/res
    };
}
// ============================================
// Factory Functions
// ============================================
function createHttp2Server(options) {
    return new Http2Server(options);
}
/**
 * Quick start HTTP/2 server with handlers
 */
async function startHttp2(options) {
    const server = new Http2Server(options);
    if (options.routes) {
        for (const [path, handler] of Object.entries(options.routes)) {
            server.get(path, handler);
        }
    }
    await server.start();
    return server;
}
exports.default = Http2Server;
