"use strict";
/**
 * CanxJS Error Handler - Custom error classes and error handling utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errors = exports.ServiceUnavailableError = exports.DatabaseError = exports.BadRequestError = exports.RateLimitError = exports.ConflictError = exports.AuthorizationError = exports.AuthenticationError = exports.NotFoundError = exports.ValidationError = exports.CanxError = void 0;
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
exports.assertFound = assertFound;
exports.assertAuthenticated = assertAuthenticated;
exports.assertAuthorized = assertAuthorized;
exports.assertValid = assertValid;
// ============================================
// Custom Error Classes
// ============================================
const ErrorHandler_1 = require("../core/ErrorHandler");
const CanxException_1 = require("../core/exceptions/CanxException");
const ValidationException_1 = require("../core/exceptions/ValidationException");
const NotFoundException_1 = require("../core/exceptions/NotFoundException");
const UnauthorizedException_1 = require("../core/exceptions/UnauthorizedException");
const ForbiddenException_1 = require("../core/exceptions/ForbiddenException");
const ConflictException_1 = require("../core/exceptions/ConflictException");
const TooManyRequestsException_1 = require("../core/exceptions/TooManyRequestsException");
const BadRequestException_1 = require("../core/exceptions/BadRequestException");
const InternalServerException_1 = require("../core/exceptions/InternalServerException");
const ServiceUnavailableException_1 = require("../core/exceptions/ServiceUnavailableException");
class CanxError extends CanxException_1.CanxException {
    constructor(message, code = 'CANX_ERROR', statusCode = 500, details) {
        super(message, statusCode, code, details);
        this.name = 'CanxError';
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            statusCode: this.status,
            details: this.details,
            timestamp: this.timestamp.toISOString(),
        };
    }
}
exports.CanxError = CanxError;
class ValidationError extends ValidationException_1.ValidationException {
    constructor(errors, message = 'Validation failed') {
        const errorRecord = errors instanceof Map ? Object.fromEntries(errors) : errors;
        super(errorRecord);
        if (message !== 'Validation Failed')
            this.message = message;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends NotFoundException_1.NotFoundException {
    constructor(resource = 'Resource', id) {
        super(resource, id);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class AuthenticationError extends UnauthorizedException_1.UnauthorizedException {
    constructor(message = 'Authentication required') {
        super(message);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends ForbiddenException_1.ForbiddenException {
    constructor(message = 'You do not have permission to access this resource') {
        super(message);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class ConflictError extends ConflictException_1.ConflictException {
    constructor(message = 'Resource conflict', resource) {
        super(message, resource); // ConflictException needs check if it accepts resource
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends TooManyRequestsException_1.TooManyRequestsException {
    retryAfter;
    constructor(retryAfter = 60, message = 'Too many requests') {
        super(message); // Check TooManyRequests signature
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
class BadRequestError extends BadRequestException_1.BadRequestException {
    constructor(message = 'Bad request') {
        super(message);
        this.name = 'BadRequestError';
    }
}
exports.BadRequestError = BadRequestError;
class DatabaseError extends InternalServerException_1.InternalServerException {
    constructor(message = 'Database error', originalError) {
        super(message);
        this.name = 'DatabaseError';
        this.details = {
            originalMessage: originalError?.message,
            stack: originalError?.stack
        };
    }
}
exports.DatabaseError = DatabaseError;
class ServiceUnavailableError extends ServiceUnavailableException_1.ServiceUnavailableException {
    constructor(service, message) {
        super(service, message);
        this.name = 'ServiceUnavailableError';
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
function errorHandler(options = {}) {
    const { showStack = process.env.NODE_ENV !== 'production', logErrors = true } = options;
    return async (req, res, next) => {
        try {
            return await next();
        }
        catch (error) {
            // Delegate to Core ErrorHandler implementation
            const response = await ErrorHandler_1.ErrorHandler.handle(error, req.raw || req, !logErrors);
            // Note: CoreErrorHandler uses Request, CanxRequest extends Request.
            // However, CoreErrorHandler logs it too.
            // The original middleware has 'logErrors' option. CoreErrorHandler has built-in logging.
            // We might need to adjust options.
            return response;
        }
    };
}
function asyncHandler(fn) {
    return async (req, res) => {
        try {
            return await fn(req, res);
        }
        catch (error) {
            if (error instanceof CanxError) {
                return res.status(error.statusCode).json(error.toJSON());
            }
            throw error;
        }
    };
}
// ============================================
// Error Assertion Helpers
// ============================================
function assertFound(value, resource = 'Resource', id) {
    if (value === null || value === undefined) {
        throw new NotFoundError(resource, id);
    }
    return value;
}
function assertAuthenticated(user) {
    if (!user) {
        throw new AuthenticationError();
    }
    return user;
}
function assertAuthorized(condition, message) {
    if (!condition) {
        throw new AuthorizationError(message);
    }
}
function assertValid(valid, errors) {
    if (!valid) {
        throw new ValidationError(errors || new Map());
    }
}
// ============================================
// Export
// ============================================
exports.errors = {
    CanxError,
    ValidationError,
    NotFoundError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    RateLimitError,
    BadRequestError,
    DatabaseError,
    ServiceUnavailableError,
};
exports.default = {
    ...exports.errors,
    errorHandler,
    asyncHandler,
    assertFound,
    assertAuthenticated,
    assertAuthorized,
    assertValid,
};
