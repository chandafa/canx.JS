"use strict";
/**
 * CanxJS API Versioning
 * URL and Header-based API versioning middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryVersioning = exports.headerVersioning = exports.urlVersioning = void 0;
exports.versioning = versioning;
exports.versionedHandler = versionedHandler;
exports.Version = Version;
exports.getVersion = getVersion;
exports.stripVersionPrefix = stripVersionPrefix;
// ============================================
// Version Extraction
// ============================================
/**
 * Extract version from URL path (e.g., /v1/users -> 1)
 */
function extractFromUrl(req, prefix = 'v') {
    const path = req.path || req.url || '';
    const regex = new RegExp(`/${prefix}(\\d+(?:\\.\\d+)?)/`);
    const match = path.match(regex);
    return match ? match[1] : null;
}
/**
 * Extract version from header
 */
function extractFromHeader(req, headerName) {
    const headers = req.headers;
    let header = null;
    if (typeof headers?.get === 'function') {
        header = headers.get(headerName.toLowerCase());
    }
    else if (headers) {
        header = headers[headerName.toLowerCase()];
    }
    if (!header)
        return null;
    return String(header).replace(/^v/i, '');
}
/**
 * Extract version from query string
 */
function extractFromQuery(req, paramName) {
    const version = req.query?.[paramName];
    if (!version)
        return null;
    return String(version).replace(/^v/i, '');
}
/**
 * Extract version from Accept header (e.g., application/vnd.api.v1+json)
 */
function extractFromAccept(req) {
    const headers = req.headers;
    let accept = null;
    if (typeof headers?.get === 'function') {
        accept = headers.get('accept');
    }
    else if (headers) {
        accept = headers.accept;
    }
    if (!accept)
        return null;
    const match = String(accept).match(/vnd\.[^.]+\.v?(\d+(?:\.\d+)?)/i);
    return match ? match[1] : null;
}
// ============================================
// Versioning Middleware
// ============================================
const DEFAULT_CONFIG = {
    type: 'url',
    default: '1',
    prefix: 'v',
    header: 'x-api-version',
    query: 'version',
};
/**
 * API Versioning middleware
 * Extracts version from request and adds to req.version
 */
function versioning(config = {}) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    return async (req, res, next) => {
        let version = null;
        switch (mergedConfig.type) {
            case 'url':
                version = extractFromUrl(req, mergedConfig.prefix);
                break;
            case 'header':
                version = extractFromHeader(req, mergedConfig.header);
                break;
            case 'query':
                version = extractFromQuery(req, mergedConfig.query);
                break;
            case 'accept':
                version = extractFromAccept(req);
                break;
        }
        // Fallback to default
        version = version || mergedConfig.default || '1';
        // Validate version if versions list provided
        if (mergedConfig.versions && !mergedConfig.versions.includes(version)) {
            return res.status(400).json({
                error: 'Invalid API version',
                message: `Supported versions: ${mergedConfig.versions.join(', ')}`,
                requested: version,
            });
        }
        // Attach version to request
        req.version = version;
        req.apiVersion = version;
        return next();
    };
}
// ============================================
// Versioned Route Handler
// ============================================
/**
 * Create versioned route handlers
 * Routes requests to appropriate handler based on version
 */
function versionedHandler(handlers, defaultVersion) {
    return async (req, res, next) => {
        const version = req.version || req.apiVersion || defaultVersion || '1';
        // Try exact match
        if (handlers[version]) {
            return handlers[version](req, res, next);
        }
        // Try major version match (e.g., "1.2" -> "1")
        const majorVersion = version.split('.')[0];
        if (handlers[majorVersion]) {
            return handlers[majorVersion](req, res, next);
        }
        // Fallback to default
        if (handlers.default) {
            return handlers.default(req, res, next);
        }
        return res.status(404).json({
            error: 'Version not supported',
            message: `No handler found for version ${version}`,
            available: Object.keys(handlers).filter(k => k !== 'default'),
        });
    };
}
// ============================================
// Version Decorators (for Controllers) - Using Map storage
// ============================================
const versionMetadataStore = new Map();
/**
 * Decorator to mark controller or method version
 */
function Version(version) {
    return function (target, propertyKey, descriptor) {
        const key = propertyKey
            ? `${target.constructor?.name || target.name}::${propertyKey}`
            : target.name;
        versionMetadataStore.set(key, version);
        return descriptor || target;
    };
}
/**
 * Get version from decorator metadata
 */
function getVersion(target, propertyKey) {
    const key = propertyKey
        ? `${target.constructor?.name || target.name}::${propertyKey}`
        : target.name;
    return versionMetadataStore.get(key);
}
// ============================================
// URL Version Rewriter
// ============================================
/**
 * Middleware to strip version prefix from URL for routing
 * Useful when you want /v1/users to be handled by /users route
 */
function stripVersionPrefix(prefix = 'v') {
    return async (req, res, next) => {
        const url = req.path || req.url || '';
        const regex = new RegExp(`^/${prefix}\\d+(?:\\.\\d+)?`);
        // Store original URL
        req.originalUrl = url;
        // Strip version prefix
        req.url = url.replace(regex, '');
        if (!req.url.startsWith('/')) {
            req.url = '/' + req.url;
        }
        return next();
    };
}
// ============================================
// Presets
// ============================================
const urlVersioning = (versions) => versioning({ type: 'url', versions });
exports.urlVersioning = urlVersioning;
const headerVersioning = (versions) => versioning({ type: 'header', versions });
exports.headerVersioning = headerVersioning;
const queryVersioning = (versions) => versioning({ type: 'query', versions });
exports.queryVersioning = queryVersioning;
exports.default = versioning;
