"use strict";
/**
 * CanxJS CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrf = csrf;
exports.csrfField = csrfField;
exports.csrfMeta = csrfMeta;
const DEFAULT_CONFIG = {
    cookieName: 'csrf_token',
    headerName: 'x-csrf-token',
    fieldName: '_csrf',
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    maxAge: 3600,
    ignorePaths: [],
};
/**
 * Generate a random CSRF token
 */
function generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
/**
 * CSRF Protection Middleware
 */
function csrf(config = {}) {
    const opts = { ...DEFAULT_CONFIG, ...config };
    return async (req, res, next) => {
        // Check if path should be ignored
        if (opts.ignorePaths.some(p => req.path.startsWith(p))) {
            return next();
        }
        // Get or create token
        let token = req.cookie(opts.cookieName);
        if (!token) {
            token = generateToken();
            res.cookie(opts.cookieName, token, {
                httpOnly: true,
                sameSite: 'Strict',
                maxAge: opts.maxAge,
                path: '/',
            });
        }
        // Attach token to request for use in views
        req.csrfToken = token;
        req.getCsrfToken = () => token;
        // Skip validation for safe methods
        if (!opts.methods.includes(req.method)) {
            return next();
        }
        // Get token from header or body
        const headerToken = req.header(opts.headerName);
        let bodyToken;
        try {
            const body = await req.body();
            bodyToken = body?.[opts.fieldName];
        }
        catch {
            // Body might not be parseable
        }
        const submittedToken = headerToken || bodyToken;
        // Validate token
        if (!submittedToken || submittedToken !== token) {
            return res.status(403).json({
                error: 'CSRF token mismatch',
                message: 'Invalid or missing CSRF token',
            });
        }
        return next();
    };
}
/**
 * Helper to generate CSRF hidden input for forms
 */
function csrfField(token) {
    return `<input type="hidden" name="_csrf" value="${token}" />`;
}
/**
 * Helper to get CSRF meta tag for AJAX
 */
function csrfMeta(token) {
    return `<meta name="csrf-token" content="${token}" />`;
}
exports.default = csrf;
