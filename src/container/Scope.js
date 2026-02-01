"use strict";
/**
 * CanxJS Provider Scopes
 * NestJS-compatible injection scopes for dependency injection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContextStore = exports.Scope = void 0;
exports.generateRequestId = generateRequestId;
exports.setRequestContext = setRequestContext;
exports.getRequestId = getRequestId;
exports.getRequestStorage = getRequestStorage;
exports.clearRequestContext = clearRequestContext;
exports.setRequestInstance = setRequestInstance;
exports.getRequestInstance = getRequestInstance;
exports.hasRequestInstance = hasRequestInstance;
exports.setScopeMetadata = setScopeMetadata;
exports.getScopeMetadata = getScopeMetadata;
exports.requestScopeMiddleware = requestScopeMiddleware;
exports.runInRequestContext = runInRequestContext;
exports.runWithRequestId = runWithRequestId;
// ============================================
// Scope Enum
// ============================================
/**
 * Provider scope determines the lifetime of provider instances
 */
var Scope;
(function (Scope) {
    /**
     * Default scope - Singleton instance shared across the entire application
     * Instance is created once and cached for all subsequent resolves
     */
    Scope["DEFAULT"] = "DEFAULT";
    /**
     * Request scope - New instance for each request
     * Instance is created once per HTTP request and shared within that request
     */
    Scope["REQUEST"] = "REQUEST";
    /**
     * Transient scope - New instance for every injection
     * Instance is created every time the dependency is resolved
     */
    Scope["TRANSIENT"] = "TRANSIENT";
})(Scope || (exports.Scope = Scope = {}));
// ============================================
// Request Context
// ============================================
/**
 * Async local storage for request context
 * Used to track request-scoped instances
 */
const requestContextStore = new Map();
exports.requestContextStore = requestContextStore;
let currentRequestId = null;
/**
 * Generate unique request ID
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Set current request context
 */
function setRequestContext(requestId) {
    currentRequestId = requestId;
    if (!requestContextStore.has(requestId)) {
        requestContextStore.set(requestId, new Map());
    }
}
/**
 * Get current request ID
 */
function getRequestId() {
    return currentRequestId;
}
/**
 * Get request-scoped instance storage
 */
function getRequestStorage() {
    if (!currentRequestId)
        return null;
    return requestContextStore.get(currentRequestId) || null;
}
/**
 * Clear request context (call at end of request)
 */
function clearRequestContext(requestId) {
    requestContextStore.delete(requestId);
    if (currentRequestId === requestId) {
        currentRequestId = null;
    }
}
/**
 * Store instance in request context
 */
function setRequestInstance(token, instance) {
    const storage = getRequestStorage();
    if (storage) {
        storage.set(token, instance);
    }
}
/**
 * Get instance from request context
 */
function getRequestInstance(token) {
    const storage = getRequestStorage();
    if (storage) {
        return storage.get(token);
    }
    return undefined;
}
/**
 * Check if instance exists in request context
 */
function hasRequestInstance(token) {
    const storage = getRequestStorage();
    if (storage) {
        return storage.has(token);
    }
    return false;
}
// ============================================
// Scope Metadata Storage
// ============================================
const scopeMetadataStore = new WeakMap();
/**
 * Set scope for a class
 */
function setScopeMetadata(target, scope) {
    scopeMetadataStore.set(target, scope);
}
/**
 * Get scope for a class
 */
function getScopeMetadata(target) {
    return scopeMetadataStore.get(target) || Scope.DEFAULT;
}
/**
 * Middleware to establish request context for scoped providers
 */
function requestScopeMiddleware() {
    return async (req, res, next) => {
        const requestId = generateRequestId();
        // Attach request ID to request object
        req.requestId = requestId;
        // Set up request context
        setRequestContext(requestId);
        try {
            // Continue with request handling
            const result = await next();
            return result;
        }
        finally {
            // Clean up request context
            clearRequestContext(requestId);
        }
    };
}
// ============================================
// AsyncLocalStorage Alternative (for Bun)
// ============================================
/**
 * Run a function within a request context
 */
async function runInRequestContext(fn) {
    const requestId = generateRequestId();
    setRequestContext(requestId);
    try {
        return await fn();
    }
    finally {
        clearRequestContext(requestId);
    }
}
/**
 * Run a function within a specific request context
 */
async function runWithRequestId(requestId, fn) {
    const previousRequestId = currentRequestId;
    setRequestContext(requestId);
    try {
        return await fn();
    }
    finally {
        if (previousRequestId) {
            currentRequestId = previousRequestId;
        }
        else {
            clearRequestContext(requestId);
        }
    }
}
