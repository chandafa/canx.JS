"use strict";
/**
 * CanxJS Auth Guards - Multiple authentication strategies
 * Laravel-compatible guards with TypeScript improvements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Guard = exports.authManager = exports.AuthManager = exports.JwtGuard = exports.TokenGuard = exports.SessionGuard = void 0;
exports.authMiddleware = authMiddleware;
exports.requireAuth = requireAuth;
exports.guestOnly = guestOnly;
exports.initAuth = initAuth;
// ============================================
// Guard Drivers
// ============================================
/**
 * Session-based authentication guard
 */
class SessionGuard {
    currentUser = null;
    sessionKey;
    constructor(sessionKey = 'user_id') {
        this.sessionKey = sessionKey;
    }
    async authenticate(req) {
        // Get user from session
        const session = req.context?.get('session');
        if (session && session[this.sessionKey]) {
            this.currentUser = await this.retrieveUser(session[this.sessionKey]);
            return this.currentUser;
        }
        return null;
    }
    user() {
        return this.currentUser;
    }
    check() {
        return this.currentUser !== null;
    }
    setUser(user) {
        this.currentUser = user;
    }
    async retrieveUser(id) {
        // This would be overridden or configured to use a user provider
        return { id };
    }
}
exports.SessionGuard = SessionGuard;
/**
 * Token-based authentication guard (API tokens)
 */
class TokenGuard {
    currentUser = null;
    tokenHeader;
    tokenPrefix;
    tokenValidator = null;
    constructor(tokenHeader = 'Authorization', tokenPrefix = 'Bearer ') {
        this.tokenHeader = tokenHeader;
        this.tokenPrefix = tokenPrefix;
    }
    setValidator(validator) {
        this.tokenValidator = validator;
        return this;
    }
    async authenticate(req) {
        const header = req.headers.get(this.tokenHeader);
        if (!header)
            return null;
        let token = header;
        if (this.tokenPrefix && header.startsWith(this.tokenPrefix)) {
            token = header.slice(this.tokenPrefix.length);
        }
        if (this.tokenValidator) {
            this.currentUser = await this.tokenValidator(token);
        }
        return this.currentUser;
    }
    user() {
        return this.currentUser;
    }
    check() {
        return this.currentUser !== null;
    }
    setUser(user) {
        this.currentUser = user;
    }
}
exports.TokenGuard = TokenGuard;
/**
 * JWT-based authentication guard
 */
class JwtGuard {
    currentUser = null;
    secret;
    header;
    prefix;
    constructor(secret, header = 'Authorization', prefix = 'Bearer ') {
        this.secret = secret;
        this.header = header;
        this.prefix = prefix;
    }
    async authenticate(req) {
        const authHeader = req.headers.get(this.header);
        if (!authHeader)
            return null;
        let token = authHeader;
        if (this.prefix && authHeader.startsWith(this.prefix)) {
            token = authHeader.slice(this.prefix.length);
        }
        try {
            const payload = await this.verifyToken(token);
            if (payload && typeof payload === 'object') {
                this.currentUser = payload;
                return this.currentUser;
            }
        }
        catch {
            return null;
        }
        return null;
    }
    user() {
        return this.currentUser;
    }
    check() {
        return this.currentUser !== null;
    }
    setUser(user) {
        this.currentUser = user;
    }
    async verifyToken(token) {
        // Simple JWT verification using Bun
        const parts = token.split('.');
        if (parts.length !== 3)
            throw new Error('Invalid token');
        const [headerB64, payloadB64, signatureB64] = parts;
        // Verify signature
        const encoder = new TextEncoder();
        const data = encoder.encode(`${headerB64}.${payloadB64}`);
        const keyData = encoder.encode(this.secret);
        const hmac = new Bun.CryptoHasher('sha256', keyData);
        hmac.update(data);
        const expectedSignature = hmac.digest('base64url');
        if (expectedSignature !== signatureB64) {
            throw new Error('Invalid signature');
        }
        // Decode payload
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
        // Check expiration
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            throw new Error('Token expired');
        }
        return payload;
    }
}
exports.JwtGuard = JwtGuard;
// ============================================
// Auth Manager
// ============================================
class AuthManager {
    guards = new Map();
    defaultGuard = 'web';
    currentRequest = null;
    /**
     * Set the default guard
     */
    setDefaultGuard(name) {
        this.defaultGuard = name;
        return this;
    }
    /**
     * Register a guard
     */
    register(name, driver) {
        this.guards.set(name, driver);
        return this;
    }
    /**
     * Get a guard by name
     */
    guard(name) {
        const guardName = name || this.defaultGuard;
        const guard = this.guards.get(guardName);
        if (!guard) {
            throw new Error(`Guard [${guardName}] is not defined.`);
        }
        return guard;
    }
    /**
     * Check if guard exists
     */
    hasGuard(name) {
        return this.guards.has(name);
    }
    /**
     * Set current request
     */
    setRequest(req) {
        this.currentRequest = req;
        return this;
    }
    /**
     * Authenticate with guard
     */
    async authenticate(guardName) {
        if (!this.currentRequest) {
            throw new Error('No request set. Call setRequest() first.');
        }
        const guard = this.guard(guardName);
        return guard.authenticate(this.currentRequest);
    }
    /**
     * Get current user
     */
    user(guardName) {
        return this.guard(guardName).user();
    }
    /**
     * Check if authenticated
     */
    check(guardName) {
        return this.guard(guardName).check();
    }
    /**
     * Get available guards
     */
    getGuards() {
        return Array.from(this.guards.keys());
    }
}
exports.AuthManager = AuthManager;
exports.Guard = AuthManager;
// ============================================
// Auth Middleware
// ============================================
/**
 * Create authentication middleware for a guard
 */
function authMiddleware(guardName) {
    return async (req, res, next) => {
        exports.authManager.setRequest(req);
        const user = await exports.authManager.authenticate(guardName);
        if (user) {
            req.user = user;
            req.context?.set('user', user);
            req.context?.set('guard', guardName || exports.authManager['defaultGuard']);
        }
        return next();
    };
}
/**
 * Require authentication middleware
 */
function requireAuth(guardName) {
    return async (req, res, next) => {
        exports.authManager.setRequest(req);
        const user = await exports.authManager.authenticate(guardName);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }
        req.user = user;
        req.context?.set('user', user);
        return next();
    };
}
/**
 * Guest only middleware (deny authenticated users)
 */
function guestOnly(guardName) {
    return async (req, res, next) => {
        exports.authManager.setRequest(req);
        const user = await exports.authManager.authenticate(guardName);
        if (user) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Already authenticated',
            });
        }
        return next();
    };
}
// ============================================
// Global Auth Manager Instance
// ============================================
exports.authManager = new AuthManager();
/**
 * Initialize auth with guards
 */
function initAuth(config) {
    if (config.default) {
        exports.authManager.setDefaultGuard(config.default);
    }
    for (const [name, guardConfig] of Object.entries(config.guards)) {
        let driver;
        switch (guardConfig.driver) {
            case 'session':
                driver = new SessionGuard(guardConfig.options?.sessionKey);
                break;
            case 'token':
                driver = new TokenGuard(guardConfig.options?.header, guardConfig.options?.prefix);
                break;
            case 'jwt':
                driver = new JwtGuard(guardConfig.options?.secret || process.env.JWT_SECRET || 'secret', guardConfig.options?.header, guardConfig.options?.prefix);
                break;
            default:
                throw new Error(`Unknown guard driver: ${guardConfig.driver}`);
        }
        exports.authManager.register(name, driver);
    }
    return exports.authManager;
}
exports.default = exports.authManager;
