"use strict";
/**
 * CanxJS Aspect-Oriented Programming (AOP)
 * Interceptors, Guards, and Pipes for cross-cutting concerns
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultValuePipe = exports.TrimPipe = exports.ParseBoolPipe = exports.ParseFloatPipe = exports.ParseIntPipe = void 0;
exports.createGuard = createGuard;
exports.applyGuards = applyGuards;
exports.createInterceptor = createInterceptor;
exports.applyInterceptors = applyInterceptors;
exports.createPipe = createPipe;
exports.createExceptionFilter = createExceptionFilter;
exports.applyExceptionFilters = applyExceptionFilters;
exports.UseGuards = UseGuards;
exports.UseInterceptors = UseInterceptors;
exports.UsePipes = UsePipes;
exports.getGuardMetadata = getGuardMetadata;
exports.getInterceptorMetadata = getInterceptorMetadata;
// ============================================
// Guard Implementation
// ============================================
/**
 * Create a guard from a function
 */
function createGuard(checkFn) {
    return {
        canActivate: checkFn,
    };
}
/**
 * Apply guards to a handler
 */
function applyGuards(guards, handler) {
    return async (req, res, next) => {
        const context = {
            request: req,
            response: res,
            handler,
            controller: null,
            methodName: '',
            args: [],
        };
        for (const guard of guards) {
            const canActivate = await guard.canActivate(context);
            if (!canActivate) {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden',
                    message: 'Access denied by guard',
                });
            }
        }
        return handler(req, res, next);
    };
}
// ============================================
// Interceptor Implementation
// ============================================
/**
 * Create an interceptor from a function
 */
function createInterceptor(interceptFn) {
    return {
        intercept: interceptFn,
    };
}
/**
 * Apply interceptors to a handler
 */
function applyInterceptors(interceptors, handler) {
    return async (req, res, next) => {
        const context = {
            request: req,
            response: res,
            handler,
            controller: null,
            methodName: '',
            args: [],
        };
        let result;
        // Build interceptor chain
        const chain = interceptors.reduceRight((nextFn, interceptor) => {
            return async () => {
                return interceptor.intercept(context, nextFn);
            };
        }, async () => handler(req, res, next));
        return chain();
    };
}
// ============================================
// Pipe Implementation
// ============================================
/**
 * Create a pipe from a function
 */
function createPipe(transformFn) {
    return {
        transform: transformFn,
    };
}
/**
 * Common pipes
 */
exports.ParseIntPipe = {
    transform(value) {
        const val = parseInt(value, 10);
        if (isNaN(val)) {
            throw new Error(`Validation failed: "${value}" is not an integer`);
        }
        return val;
    },
};
exports.ParseFloatPipe = {
    transform(value) {
        const val = parseFloat(value);
        if (isNaN(val)) {
            throw new Error(`Validation failed: "${value}" is not a number`);
        }
        return val;
    },
};
exports.ParseBoolPipe = {
    transform(value) {
        if (value === 'true' || value === '1')
            return true;
        if (value === 'false' || value === '0')
            return false;
        throw new Error(`Validation failed: "${value}" is not a boolean`);
    },
};
exports.TrimPipe = {
    transform(value) {
        return typeof value === 'string' ? value.trim() : value;
    },
};
const DefaultValuePipe = (defaultValue) => ({
    transform(value) {
        return value !== undefined && value !== null ? value : defaultValue;
    },
});
exports.DefaultValuePipe = DefaultValuePipe;
// ============================================
// Exception Filter Implementation
// ============================================
/**
 * Create an exception filter from a function
 */
function createExceptionFilter(catchFn) {
    return {
        catch: catchFn,
    };
}
/**
 * Apply exception filters to a handler
 */
function applyExceptionFilters(filters, handler) {
    return async (req, res, next) => {
        const context = {
            request: req,
            response: res,
            handler,
            controller: null,
            methodName: '',
            args: [],
        };
        try {
            return await handler(req, res, next);
        }
        catch (error) {
            for (const filter of filters) {
                await filter.catch(error, context);
            }
            // If no filter handles it, rethrow
            if (!res.headersSent) {
                throw error;
            }
        }
    };
}
// ============================================
// Decorator Metadata Storage
// ============================================
const guardMetadata = new Map();
const interceptorMetadata = new Map();
const pipeMetadata = new Map();
/**
 * UseGuards decorator
 */
function UseGuards(...guards) {
    return function (target, propertyKey, descriptor) {
        const key = propertyKey ? `${target.constructor.name}.${String(propertyKey)}` : target.name;
        const resolvedGuards = guards.map(g => typeof g === 'function' ? new g() : g);
        guardMetadata.set(key, resolvedGuards);
        return descriptor || target;
    };
}
/**
 * UseInterceptors decorator
 */
function UseInterceptors(...interceptors) {
    return function (target, propertyKey, descriptor) {
        const key = propertyKey ? `${target.constructor.name}.${String(propertyKey)}` : target.name;
        const resolvedInterceptors = interceptors.map(i => typeof i === 'function' ? new i() : i);
        interceptorMetadata.set(key, resolvedInterceptors);
        return descriptor || target;
    };
}
/**
 * UsePipes decorator
 */
function UsePipes(...pipes) {
    return function (target, propertyKey, descriptor) {
        const key = propertyKey ? `${target.constructor.name}.${String(propertyKey)}` : target.name;
        const resolvedPipes = pipes.map(p => typeof p === 'function' ? new p() : p);
        pipeMetadata.set(key, resolvedPipes);
        return descriptor || target;
    };
}
/**
 * Get guard metadata
 */
function getGuardMetadata(target, propertyKey) {
    const key = propertyKey ? `${target.name}.${propertyKey}` : target.name;
    return guardMetadata.get(key) || [];
}
/**
 * Get interceptor metadata
 */
function getInterceptorMetadata(target, propertyKey) {
    const key = propertyKey ? `${target.name}.${propertyKey}` : target.name;
    return interceptorMetadata.get(key) || [];
}
exports.default = { createGuard, createInterceptor, createPipe, createExceptionFilter };
