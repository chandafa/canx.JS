"use strict";
/**
 * CanxJS Server - High-performance HTTP server wrapper for Bun
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
exports.createCanxRequest = createCanxRequest;
exports.createCanxResponse = createCanxResponse;
const ErrorHandler_1 = require("./ErrorHandler");
const picocolors_1 = __importDefault(require("picocolors"));
/**
 * Generate unique request ID
 */
function generateRequestId() {
    return `canx_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}
/**
 * Parse cookies from header
 */
function parseCookies(cookieHeader) {
    const cookies = new Map();
    if (!cookieHeader)
        return cookies;
    cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.split('=');
        if (name) {
            cookies.set(name.trim(), rest.join('=').trim());
        }
    });
    return cookies;
}
/**
 * Parse query string
 */
function parseQuery(url) {
    const query = {};
    url.searchParams.forEach((value, key) => {
        const existing = query[key];
        if (existing !== undefined) {
            if (Array.isArray(existing)) {
                existing.push(value);
            }
            else {
                query[key] = [existing, value];
            }
        }
        else {
            query[key] = value;
        }
    });
    return query;
}
/**
 * Create enhanced CanxRequest from raw Bun Request
 */
function createCanxRequest(raw, params = {}) {
    const url = new URL(raw.url);
    const cookies = parseCookies(raw.headers.get('cookie'));
    let bodyParsed = false;
    let cachedBody;
    const request = {
        raw,
        method: raw.method.toUpperCase(),
        path: url.pathname,
        params,
        query: parseQuery(url),
        headers: raw.headers,
        context: new Map(),
        timestamp: Date.now(),
        id: generateRequestId(),
        session: undefined,
        async body() {
            if (bodyParsed)
                return cachedBody;
            const contentType = raw.headers.get('content-type') || '';
            try {
                if (contentType.includes('application/json')) {
                    cachedBody = await raw.json();
                }
                else if (contentType.includes('application/x-www-form-urlencoded')) {
                    const text = await raw.text();
                    cachedBody = Object.fromEntries(new URLSearchParams(text));
                }
                else if (contentType.includes('multipart/form-data')) {
                    // FormData is special, it doesn't map nicely to a simple object for simple caching without loss
                    // But let's cache it as FormData object?
                    // Usually body() implies "data payload". 
                    // Let's stick to raw.formData() but mark parsed.
                    // cachedBody = await raw.formData();
                    // Actually, let's allow formData to be separate or handle it here?
                    cachedBody = await raw.formData();
                }
                else {
                    cachedBody = await raw.text();
                }
                bodyParsed = true;
                return cachedBody;
            }
            catch (e) {
                throw new Error(`Failed to parse body: ${e.message}`);
            }
        },
        async json() {
            if (bodyParsed)
                return cachedBody;
            cachedBody = await raw.json();
            bodyParsed = true;
            return cachedBody;
        },
        async formData() {
            if (bodyParsed && cachedBody instanceof FormData)
                return cachedBody;
            return raw.formData();
        },
        async text() {
            if (bodyParsed) {
                if (typeof cachedBody === 'string')
                    return cachedBody;
                if (typeof cachedBody === 'object')
                    return JSON.stringify(cachedBody);
                return String(cachedBody);
            }
            const text = await raw.text();
            cachedBody = text;
            bodyParsed = true;
            return text;
        },
        async arrayBuffer() {
            return raw.arrayBuffer();
        },
        async files() {
            const files = new Map();
            const formData = await raw.formData();
            formData.forEach((value, key) => {
                if (value instanceof File) {
                    files.set(key, value);
                }
            });
            return files;
        },
        header(name) {
            return raw.headers.get(name);
        },
        cookie(name) {
            return cookies.get(name);
        },
    };
    return request;
}
/**
 * Create CanxResponse builder
 */
function createCanxResponse() {
    let statusCode = 200;
    const responseHeaders = new Headers();
    const responseCookies = [];
    let headersSentFlag = false;
    const response = {
        headersSent: false,
        status(code) {
            statusCode = code;
            return response;
        },
        header(name, value) {
            responseHeaders.set(name, value);
            return response;
        },
        headers(headers) {
            Object.entries(headers).forEach(([name, value]) => {
                responseHeaders.set(name, value);
            });
            return response;
        },
        json(data) {
            responseHeaders.set('Content-Type', 'application/json');
            addCookiesToHeaders();
            return new Response(JSON.stringify(data), {
                status: statusCode,
                headers: responseHeaders,
            });
        },
        html(content) {
            responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
            addCookiesToHeaders();
            return new Response(content, {
                status: statusCode,
                headers: responseHeaders,
            });
        },
        text(content) {
            responseHeaders.set('Content-Type', 'text/plain; charset=utf-8');
            addCookiesToHeaders();
            return new Response(content, {
                status: statusCode,
                headers: responseHeaders,
            });
        },
        async file(path) {
            const file = Bun.file(path);
            const exists = await file.exists();
            if (!exists) {
                return new Response('File not found', { status: 404 });
            }
            responseHeaders.set('Content-Type', file.type);
            responseHeaders.set('Content-Length', String(file.size));
            addCookiesToHeaders();
            return new Response(file, {
                status: statusCode,
                headers: responseHeaders,
            });
        },
        async download(path, filename) {
            const file = Bun.file(path);
            const exists = await file.exists();
            if (!exists) {
                return new Response('File not found', { status: 404 });
            }
            const downloadName = filename || path.split('/').pop() || 'download';
            responseHeaders.set('Content-Type', 'application/octet-stream');
            responseHeaders.set('Content-Disposition', `attachment; filename="${downloadName}"`);
            responseHeaders.set('Content-Length', String(file.size));
            addCookiesToHeaders();
            return new Response(file, {
                status: statusCode,
                headers: responseHeaders,
            });
        },
        stream(readable) {
            responseHeaders.set('Content-Type', 'application/octet-stream');
            responseHeaders.set('Transfer-Encoding', 'chunked');
            addCookiesToHeaders();
            return new Response(readable, {
                status: statusCode,
                headers: responseHeaders,
            });
        },
        redirect(url, status = 302) {
            responseHeaders.set('Location', url);
            addCookiesToHeaders();
            return new Response(null, {
                status,
                headers: responseHeaders,
            });
        },
        cookie(name, value, options = {}) {
            let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
            if (options.maxAge !== undefined) {
                cookieStr += `; Max-Age=${options.maxAge}`;
            }
            if (options.expires) {
                cookieStr += `; Expires=${options.expires.toUTCString()}`;
            }
            if (options.path) {
                cookieStr += `; Path=${options.path}`;
            }
            if (options.domain) {
                cookieStr += `; Domain=${options.domain}`;
            }
            if (options.secure) {
                cookieStr += '; Secure';
            }
            if (options.httpOnly) {
                cookieStr += '; HttpOnly';
            }
            if (options.sameSite) {
                cookieStr += `; SameSite=${options.sameSite}`;
            }
            responseCookies.push(cookieStr);
            return response;
        },
        clearCookie(name) {
            return response.cookie(name, '', { maxAge: 0 });
        },
        render(component) {
            // Will be implemented with View engine
            responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
            addCookiesToHeaders();
            // Convert JSX to string (Bun's renderToString)
            const html = String(component);
            return new Response(html, {
                status: statusCode,
                headers: responseHeaders,
            });
        },
        empty(status = 204) {
            addCookiesToHeaders();
            return new Response(null, {
                status,
                headers: responseHeaders,
            });
        },
        sse(generator) {
            responseHeaders.set('Content-Type', 'text/event-stream');
            responseHeaders.set('Cache-Control', 'no-cache');
            responseHeaders.set('Connection', 'keep-alive');
            addCookiesToHeaders();
            const stream = new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    try {
                        for await (const data of generator) {
                            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                        }
                        controller.close();
                    }
                    catch (error) {
                        controller.error(error);
                    }
                },
            });
            return new Response(stream, {
                status: statusCode,
                headers: responseHeaders,
            });
        },
        hotwire(content, options = { target: 'body' }) {
            responseHeaders.set('Content-Type', 'text/vnd.turbo-stream.html; charset=utf-8');
            addCookiesToHeaders();
            const action = options.action || 'replace';
            const target = options.target;
            // Clean up content if it's not a string (e.g. if extended to support array/objects)
            const htmlContent = String(content);
            const streamHtml = `
<turbo-stream action="${action}" target="${target}">
  <template>
    ${htmlContent}
  </template>
</turbo-stream>`.trim();
            return new Response(streamHtml, {
                status: statusCode,
                headers: responseHeaders,
            });
        },
    };
    function addCookiesToHeaders() {
        responseCookies.forEach(cookie => {
            responseHeaders.append('Set-Cookie', cookie);
        });
    }
    return response;
}
/**
 * Default CORS headers
 */
function getCorsHeaders(config, origin) {
    const headers = new Headers();
    // Origin
    if (config.origin === true) {
        headers.set('Access-Control-Allow-Origin', origin);
    }
    else if (typeof config.origin === 'string') {
        headers.set('Access-Control-Allow-Origin', config.origin);
    }
    else if (Array.isArray(config.origin)) {
        if (config.origin.includes(origin)) {
            headers.set('Access-Control-Allow-Origin', origin);
        }
    }
    else if (typeof config.origin === 'function') {
        if (config.origin(origin)) {
            headers.set('Access-Control-Allow-Origin', origin);
        }
    }
    // Methods
    if (config.methods) {
        headers.set('Access-Control-Allow-Methods', config.methods.join(', '));
    }
    // Headers
    if (config.allowedHeaders) {
        headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    }
    if (config.exposedHeaders) {
        headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
    }
    // Credentials
    if (config.credentials) {
        headers.set('Access-Control-Allow-Credentials', 'true');
    }
    // Max Age
    if (config.maxAge) {
        headers.set('Access-Control-Max-Age', String(config.maxAge));
    }
    return headers;
}
/**
 * CanxJS Server Class
 */
class Server {
    server = null;
    config;
    requestHandler;
    constructor(config, handler) {
        this.config = {
            port: 3000,
            hostname: '0.0.0.0',
            development: process.env.NODE_ENV !== 'production',
            maxBodySize: 10 * 1024 * 1024, // 10MB
            timeout: 30000,
            compression: true,
            ...config,
        };
        this.requestHandler = handler;
    }
    /**
     * Handle a request directly (useful for testing)
     */
    async handle(req) {
        return this.requestHandler(req);
    }
    /**
     * Start the server
     */
    async listen(callback) {
        const corsConfig = this.config.cors === true
            ? { origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }
            : this.config.cors || null;
        try {
            this.server = Bun.serve({
                port: this.config.port,
                hostname: this.config.hostname,
                development: this.config.development,
                tls: this.config.tls ? {
                    cert: Bun.file(this.config.tls.cert),
                    key: Bun.file(this.config.tls.key),
                    ca: this.config.tls.ca ? Bun.file(this.config.tls.ca) : undefined,
                    passphrase: this.config.tls.passphrase,
                } : undefined,
                fetch: async (req) => {
                    const startTime = performance.now();
                    try {
                        // Handle CORS preflight
                        if (corsConfig && req.method === 'OPTIONS') {
                            const origin = req.headers.get('origin') || '';
                            const headers = getCorsHeaders(corsConfig, origin);
                            return new Response(null, { status: 204, headers });
                        }
                        // Handle static files
                        if (this.config.static) {
                            const url = new URL(req.url);
                            if (url.pathname.startsWith('/static/')) {
                                const filePath = `${this.config.static}${url.pathname.replace('/static', '')}`;
                                const file = Bun.file(filePath);
                                if (await file.exists()) {
                                    return new Response(file);
                                }
                            }
                        }
                        // Main request handling
                        let response = await this.requestHandler(req);
                        // Add CORS headers
                        if (corsConfig) {
                            const origin = req.headers.get('origin') || '';
                            const corsHeaders = getCorsHeaders(corsConfig, origin);
                            corsHeaders.forEach((value, key) => {
                                response.headers.set(key, value);
                            });
                        }
                        // Add timing header in development
                        if (this.config.development) {
                            const duration = (performance.now() - startTime).toFixed(2);
                            response.headers.set('X-Response-Time', `${duration}ms`);
                        }
                        return response;
                    }
                    catch (error) {
                        return ErrorHandler_1.ErrorHandler.handle(error, req, this.config.development);
                    }
                },
                error(error) {
                    // Can't access req object easily here in Bun's error handler, 
                    // but it catches low-level server errors
                    console.error('[CanxJS Server Error]', error);
                    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
                },
            });
            if (callback) {
                callback();
            }
            const displayHost = this.config.hostname === '0.0.0.0' ? 'localhost' : this.config.hostname;
            const environment = this.config.development ? picocolors_1.default.yellow('development') : picocolors_1.default.green('production');
            const url = `http://${displayHost}:${this.config.port}`;
            console.log(`
${picocolors_1.default.cyan('╔══════════════════════════════════════════════════════════╗')}
${picocolors_1.default.cyan('║')}                                                          ${picocolors_1.default.cyan('║')}
${picocolors_1.default.cyan('║')}   🚀 ${picocolors_1.default.bold(picocolors_1.default.magenta('CanxJS Server'))} running                               ${picocolors_1.default.cyan('║')}
${picocolors_1.default.cyan('║')}                                                          ${picocolors_1.default.cyan('║')}
${picocolors_1.default.cyan('║')}   → Local:   ${picocolors_1.default.bold(picocolors_1.default.underline(url))}                        ${picocolors_1.default.cyan('║')}
${picocolors_1.default.cyan('║')}   → Mode:    ${environment}                              ${picocolors_1.default.cyan('║')}
${picocolors_1.default.cyan('║')}                                                          ${picocolors_1.default.cyan('║')}
${picocolors_1.default.cyan('╚══════════════════════════════════════════════════════════╝')}
      `);
        }
        catch (error) {
            if (error.code === 'EADDRINUSE' || error.message?.includes('EADDRINUSE') || error.syscall === 'listen') {
                console.error(`
${picocolors_1.default.red('╔══════════════════════════════════════════════════════════╗')}
${picocolors_1.default.red('║')}                                                          ${picocolors_1.default.red('║')}
${picocolors_1.default.red('║')}   ❌ ${picocolors_1.default.bold('ERROR: Port ' + this.config.port + ' is already in use')}                  ${picocolors_1.default.red('║')}
${picocolors_1.default.red('║')}                                                          ${picocolors_1.default.red('║')}
${picocolors_1.default.red('║')}   It looks like another application is already using     ${picocolors_1.default.red('║')}
${picocolors_1.default.red('║')}   this port. Please try:                                 ${picocolors_1.default.red('║')}
${picocolors_1.default.red('║')}                                                          ${picocolors_1.default.red('║')}
${picocolors_1.default.red('║')}   1. Stopping the other process                          ${picocolors_1.default.red('║')}
${picocolors_1.default.red('║')}   2. Using a different port in your app config           ${picocolors_1.default.red('║')}
${picocolors_1.default.red('║')}      (e.g., app.create({ port: ${Number(this.config.port) + 1} }))              ${picocolors_1.default.red('║')}
${picocolors_1.default.red('║')}                                                          ${picocolors_1.default.red('║')}
${picocolors_1.default.red('╚══════════════════════════════════════════════════════════╝')}
        `);
                process.exit(1);
            }
            else {
                throw error;
            }
        }
    }
    /**
     * Stop the server gracefully
     */
    async close() {
        if (this.server) {
            this.server.stop();
            this.server = null;
            console.log('[CanxJS] Server stopped gracefully');
        }
    }
    /**
     * Get server instance
     */
    get instance() {
        return this.server;
    }
}
exports.Server = Server;
exports.default = Server;
