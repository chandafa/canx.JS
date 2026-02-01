"use strict";
/**
 * CanxJS Response - Enhanced response utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseBuilder = void 0;
exports.response = response;
class ResponseBuilder {
    statusCode = 200;
    headers = new Headers();
    cookies = [];
    status(code) {
        this.statusCode = code;
        return this;
    }
    header(name, value) {
        this.headers.set(name, value);
        return this;
    }
    cookie(name, value, options = {}) {
        let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
        if (options.maxAge)
            cookieStr += `; Max-Age=${options.maxAge}`;
        if (options.expires)
            cookieStr += `; Expires=${options.expires.toUTCString()}`;
        if (options.path)
            cookieStr += `; Path=${options.path}`;
        if (options.domain)
            cookieStr += `; Domain=${options.domain}`;
        if (options.secure)
            cookieStr += '; Secure';
        if (options.httpOnly)
            cookieStr += '; HttpOnly';
        if (options.sameSite)
            cookieStr += `; SameSite=${options.sameSite}`;
        this.cookies.push(cookieStr);
        return this;
    }
    finalize() {
        this.cookies.forEach(c => this.headers.append('Set-Cookie', c));
        return this.headers;
    }
    json(data) {
        this.headers.set('Content-Type', 'application/json');
        return new Response(JSON.stringify(data), { status: this.statusCode, headers: this.finalize() });
    }
    html(content) {
        this.headers.set('Content-Type', 'text/html; charset=utf-8');
        return new Response(content, { status: this.statusCode, headers: this.finalize() });
    }
    text(content) {
        this.headers.set('Content-Type', 'text/plain; charset=utf-8');
        return new Response(content, { status: this.statusCode, headers: this.finalize() });
    }
    redirect(url, status = 302) {
        this.headers.set('Location', url);
        return new Response(null, { status, headers: this.finalize() });
    }
    async file(path) {
        const file = Bun.file(path);
        if (!(await file.exists()))
            return new Response('Not Found', { status: 404 });
        this.headers.set('Content-Type', file.type);
        this.headers.set('Content-Length', String(file.size));
        return new Response(file, { status: this.statusCode, headers: this.finalize() });
    }
    async download(path, filename) {
        const file = Bun.file(path);
        if (!(await file.exists()))
            return new Response('Not Found', { status: 404 });
        const name = filename || path.split('/').pop() || 'download';
        this.headers.set('Content-Type', 'application/octet-stream');
        this.headers.set('Content-Disposition', `attachment; filename="${name}"`);
        return new Response(file, { status: this.statusCode, headers: this.finalize() });
    }
    stream(readable) {
        this.headers.set('Transfer-Encoding', 'chunked');
        return new Response(readable, { status: this.statusCode, headers: this.finalize() });
    }
    sse(generator) {
        this.headers.set('Content-Type', 'text/event-stream');
        this.headers.set('Cache-Control', 'no-cache');
        this.headers.set('Connection', 'keep-alive');
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const data of generator) {
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                    controller.close();
                }
                catch (e) {
                    controller.error(e);
                }
            },
        });
        return new Response(stream, { status: this.statusCode, headers: this.finalize() });
    }
    empty(status = 204) {
        return new Response(null, { status, headers: this.finalize() });
    }
}
exports.ResponseBuilder = ResponseBuilder;
function response() {
    return new ResponseBuilder();
}
exports.default = ResponseBuilder;
