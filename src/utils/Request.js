"use strict";
/**
 * CanxJS Request - Enhanced request utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestParser = void 0;
exports.parseRequest = parseRequest;
class RequestParser {
    raw;
    url;
    _cookies = null;
    _body = undefined;
    _bodyParsed = false;
    constructor(raw) {
        this.raw = raw;
        this.url = new URL(raw.url);
    }
    get method() {
        return this.raw.method.toUpperCase();
    }
    get path() {
        return this.url.pathname;
    }
    get headers() {
        return this.raw.headers;
    }
    get query() {
        const query = {};
        this.url.searchParams.forEach((value, key) => {
            const existing = query[key];
            if (existing !== undefined) {
                query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
            }
            else {
                query[key] = value;
            }
        });
        return query;
    }
    get cookies() {
        if (!this._cookies) {
            this._cookies = new Map();
            const header = this.raw.headers.get('cookie');
            if (header) {
                header.split(';').forEach(c => {
                    const [name, ...rest] = c.split('=');
                    if (name)
                        this._cookies.set(name.trim(), rest.join('=').trim());
                });
            }
        }
        return this._cookies;
    }
    header(name) {
        return this.raw.headers.get(name);
    }
    cookie(name) {
        return this.cookies.get(name);
    }
    async body() {
        if (!this._bodyParsed) {
            const contentType = this.raw.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                this._body = await this.raw.json();
            }
            else if (contentType.includes('application/x-www-form-urlencoded')) {
                const text = await this.raw.text();
                this._body = Object.fromEntries(new URLSearchParams(text));
            }
            else if (contentType.includes('multipart/form-data')) {
                this._body = await this.raw.formData();
            }
            else {
                this._body = await this.raw.text();
            }
            this._bodyParsed = true;
        }
        return this._body;
    }
    async json() {
        if (!this._bodyParsed) {
            this._body = await this.raw.json();
            this._bodyParsed = true;
        }
        return this._body;
    }
    async formData() {
        return this.raw.formData();
    }
    async text() {
        return this.raw.text();
    }
    async arrayBuffer() {
        return this.raw.arrayBuffer();
    }
    async files() {
        const files = new Map();
        const formData = await this.raw.formData();
        formData.forEach((value, key) => {
            if (value instanceof File)
                files.set(key, value);
        });
        return files;
    }
    get ip() {
        return this.header('x-forwarded-for')?.split(',')[0]?.trim() ||
            this.header('x-real-ip') ||
            'unknown';
    }
    get userAgent() {
        return this.header('user-agent');
    }
    get isAjax() {
        return this.header('x-requested-with')?.toLowerCase() === 'xmlhttprequest';
    }
    get isSecure() {
        return this.url.protocol === 'https:';
    }
    get accepts() {
        return (this.header('accept') || '*/*').split(',').map(s => s.trim().split(';')[0]);
    }
}
exports.RequestParser = RequestParser;
function parseRequest(raw) {
    return new RequestParser(raw);
}
exports.default = RequestParser;
