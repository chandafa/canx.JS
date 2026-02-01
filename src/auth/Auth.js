"use strict";
/**
 * CanxJS Auth - Built-in Authentication System
 * JWT + Session + OAuth2 support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseSessionDriver = exports.auth = exports.sessionStore = exports.SessionStore = exports.MemorySessionDriver = void 0;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.signJWT = signJWT;
exports.verifyJWT = verifyJWT;
exports.jwtAuth = jwtAuth;
exports.optionalAuth = optionalAuth;
exports.protect = protect;
exports.guest = guest;
exports.roles = roles;
exports.sessionAuth = sessionAuth;
// ============================================
// Password Hashing
// ============================================
async function hashPassword(password) {
    return Bun.password.hash(password, {
        algorithm: 'argon2id',
        memoryCost: 65536,
        timeCost: 3,
    });
}
async function verifyPassword(password, hash) {
    return Bun.password.verify(password, hash);
}
const encoder = new TextEncoder();
async function createHmacKey(secret, algorithm) {
    return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: algorithm }, false, ['sign', 'verify']);
}
function base64UrlEncode(data) {
    const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4)
        str += '=';
    return atob(str);
}
async function signJWT(payload, config) {
    const alg = config.algorithm || 'HS256';
    const hashAlg = alg === 'HS256' ? 'SHA-256' : alg === 'HS384' ? 'SHA-384' : 'SHA-512';
    const header = { alg, typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
        ...payload,
        iat: now,
        exp: now + (config.expiresIn || 86400), // 24 hours default
    };
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
    const data = `${headerB64}.${payloadB64}`;
    const key = await createHmacKey(config.secret, hashAlg);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const signatureB64 = base64UrlEncode(new Uint8Array(signature).reduce((s, b) => s + String.fromCharCode(b), ''));
    return `${data}.${signatureB64}`;
}
async function verifyJWT(token, config) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const [headerB64, payloadB64, signatureB64] = parts;
        const header = JSON.parse(base64UrlDecode(headerB64));
        const alg = header.alg || 'HS256';
        // Security: Enforce allowed algorithm
        const allowedAlg = config.algorithm || 'HS256';
        if (alg !== allowedAlg) {
            // Silent fail or return null for security (avoid enumeration)
            return null;
        }
        const hashAlg = allowedAlg === 'HS256' ? 'SHA-256' : allowedAlg === 'HS384' ? 'SHA-384' : 'SHA-512';
        // Verify signature
        const key = await createHmacKey(config.secret, hashAlg);
        const data = `${headerB64}.${payloadB64}`;
        const signature = Uint8Array.from(base64UrlDecode(signatureB64), c => c.charCodeAt(0));
        const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
        if (!valid)
            return null;
        // Decode and check expiration
        const payload = JSON.parse(base64UrlDecode(payloadB64));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null; // Token expired
        }
        return payload;
    }
    catch {
        return null;
    }
}
function jwtAuth(config) {
    return async (req, res, next) => {
        const header = req.header(config.tokenHeader || 'authorization');
        if (!header) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const prefix = config.tokenPrefix || 'Bearer ';
        if (!header.startsWith(prefix)) {
            return res.status(401).json({ error: 'Invalid token format' });
        }
        const token = header.slice(prefix.length);
        const payload = await verifyJWT(token, { secret: config.secret });
        if (!payload) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        // Attach user to request context
        req.context.set(config.userProperty || 'user', payload);
        return next();
    };
}
function optionalAuth(config) {
    return async (req, res, next) => {
        const header = req.header(config.tokenHeader || 'authorization');
        if (header) {
            const prefix = config.tokenPrefix || 'Bearer ';
            if (header.startsWith(prefix)) {
                const token = header.slice(prefix.length);
                const payload = await verifyJWT(token, { secret: config.secret });
                if (payload) {
                    req.context.set(config.userProperty || 'user', payload);
                }
            }
        }
        return next();
    };
}
// ============================================
// Auth Guard Helpers
// ============================================
function protect(config) {
    return jwtAuth(config);
}
function guest() {
    return async (req, res, next) => {
        if (req.context.has('user')) {
            return res.status(403).json({ error: 'Already authenticated' });
        }
        return next();
    };
}
function roles(...allowedRoles) {
    return async (req, res, next) => {
        const user = req.context.get('user');
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userRole = user.role || user.roles;
        const hasRole = Array.isArray(userRole)
            ? userRole.some(r => allowedRoles.includes(r))
            : allowedRoles.includes(userRole);
        if (!hasRole) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        return next();
    };
}
class MemorySessionDriver {
    sessions = new Map();
    generateId() {
        return `sess_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '')}`;
    }
    create(userId, data = {}, maxAge = 86400000) {
        const session = {
            id: this.generateId(),
            userId,
            data,
            expiresAt: Date.now() + maxAge,
        };
        this.sessions.set(session.id, session);
        return session;
    }
    get(id) {
        const session = this.sessions.get(id);
        if (!session)
            return null;
        if (Date.now() > session.expiresAt) {
            this.sessions.delete(id);
            return null;
        }
        return session;
    }
    destroy(id) {
        return this.sessions.delete(id);
    }
    cleanup() {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (now > session.expiresAt)
                this.sessions.delete(id);
        }
    }
}
exports.MemorySessionDriver = MemorySessionDriver;
// Avoid circular dependency issues by importing types only if needed
const DatabaseSessionDriver_1 = require("./drivers/DatabaseSessionDriver");
class SessionStore {
    driver;
    constructor(driver) {
        this.driver = driver || new MemorySessionDriver();
    }
    // Method to easily switch to database
    useDatabase() {
        this.driver = new DatabaseSessionDriver_1.DatabaseSessionDriver();
    }
    use(driver) {
        this.driver = driver;
    }
    async create(userId, data = {}, maxAge = 86400000) {
        return this.driver.create(userId, data, maxAge);
    }
    async get(id) {
        return this.driver.get(id);
    }
    async destroy(id) {
        return this.driver.destroy(id);
    }
    async cleanup() {
        return this.driver.cleanup();
    }
}
exports.SessionStore = SessionStore;
exports.sessionStore = new SessionStore();
function sessionAuth(cookieName = 'canx_session') {
    return async (req, res, next) => {
        const sessionId = req.cookie(cookieName);
        if (sessionId) {
            const session = await exports.sessionStore.get(sessionId);
            if (session) {
                req.context.set('session', session);
                req.context.set('user', { sub: session.userId, ...session.data });
            }
        }
        return next();
    };
}
// ============================================
// Auth Module Export
// ============================================
exports.auth = {
    // Password
    hash: hashPassword,
    verify: verifyPassword,
    // JWT
    sign: signJWT,
    verifyToken: verifyJWT,
    // Middleware
    jwt: jwtAuth,
    optional: optionalAuth,
    protect,
    guest,
    roles,
    session: sessionAuth,
    // Session store
    sessions: exports.sessionStore,
};
var DatabaseSessionDriver_2 = require("./drivers/DatabaseSessionDriver");
Object.defineProperty(exports, "DatabaseSessionDriver", { enumerable: true, get: function () { return DatabaseSessionDriver_2.DatabaseSessionDriver; } });
exports.default = exports.auth;
