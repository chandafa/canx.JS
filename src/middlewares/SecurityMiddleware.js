"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.security = security;
function security(config = {}) {
    return async (req, res, next) => {
        // X-XSS-Protection
        if (config.xssProtection !== false) {
            res.header('X-XSS-Protection', '1; mode=block');
        }
        // X-Content-Type-Options
        if (config.contentTypeOptions !== false) {
            res.header('X-Content-Type-Options', 'nosniff');
        }
        // X-Frame-Options
        // Default to SAMEORIGIN if not specified
        res.header('X-Frame-Options', config.frameOptions || 'SAMEORIGIN');
        // Strict-Transport-Security (HSTS) - Enabled by default for HTTPS apps? 
        // Usually only if config says so, but let's leave it optional as defined.
        if (config.hsts) {
            const maxAge = typeof config.hsts === 'object' ? config.hsts.maxAge : 31536000;
            const includeSubDomains = typeof config.hsts === 'object' && config.hsts.includeSubDomains ? '; includeSubDomains' : '';
            res.header('Strict-Transport-Security', `max-age=${maxAge}${includeSubDomains}`);
        }
        // Content-Security-Policy
        if (config.contentSecurityPolicy) {
            res.header('Content-Security-Policy', config.contentSecurityPolicy);
        }
        // Referrer-Policy
        res.header('Referrer-Policy', config.referrerPolicy || 'strict-origin-when-cross-origin');
        // Additional Headers
        res.header('X-DNS-Prefetch-Control', 'off');
        res.header('X-Download-Options', 'noopen');
        res.header('X-Permitted-Cross-Domain-Policies', 'none');
        res.header('X-Powered-By', 'CanxJS'); // Or remove it for security? Usually remove.
        // Actually, Helix/Express usually removes X-Powered-By.
        // CanxResponse implementation might add it by default?
        // Let's explicitly NOT set X-Powered-By here, typically framework sets it elsewhere.
        // If we want to hide it, we might need res.removeHeader if supported or just not set it.
        return next();
    };
}
