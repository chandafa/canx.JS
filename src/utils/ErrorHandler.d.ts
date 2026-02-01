/**
 * CanxJS Error Handler - Custom error classes and error handling utilities
 */
import { CanxException } from '../core/exceptions/CanxException';
import { ValidationException } from '../core/exceptions/ValidationException';
import { NotFoundException as CoreNotFoundException } from '../core/exceptions/NotFoundException';
import { UnauthorizedException } from '../core/exceptions/UnauthorizedException';
import { ForbiddenException } from '../core/exceptions/ForbiddenException';
import { ConflictException } from '../core/exceptions/ConflictException';
import { TooManyRequestsException } from '../core/exceptions/TooManyRequestsException';
import { BadRequestException } from '../core/exceptions/BadRequestException';
import { InternalServerException } from '../core/exceptions/InternalServerException';
import { ServiceUnavailableException as CoreServiceUnavailableException } from '../core/exceptions/ServiceUnavailableException';
export declare class CanxError extends CanxException {
    constructor(message: string, code?: string, statusCode?: number, details?: Record<string, unknown>);
    toJSON(): {
        name: string;
        code: string;
        message: string;
        statusCode: number;
        details: any;
        timestamp: string;
    };
}
export declare class ValidationError extends ValidationException {
    constructor(errors: Map<string, string[]> | Record<string, string[]>, message?: string);
}
export declare class NotFoundError extends CoreNotFoundException {
    constructor(resource?: string, id?: string | number);
}
export declare class AuthenticationError extends UnauthorizedException {
    constructor(message?: string);
}
export declare class AuthorizationError extends ForbiddenException {
    constructor(message?: string);
}
export declare class ConflictError extends ConflictException {
    constructor(message?: string, resource?: string);
}
export declare class RateLimitError extends TooManyRequestsException {
    readonly retryAfter: number;
    constructor(retryAfter?: number, message?: string);
}
export declare class BadRequestError extends BadRequestException {
    constructor(message?: string);
}
export declare class DatabaseError extends InternalServerException {
    constructor(message?: string, originalError?: Error);
}
export declare class ServiceUnavailableError extends CoreServiceUnavailableException {
    constructor(service: string, message?: string);
}
import type { MiddlewareHandler, CanxRequest, CanxResponse } from '../types';
interface ErrorHandlerOptions {
    showStack?: boolean;
    logErrors?: boolean;
    onError?: (error: Error, req: CanxRequest) => void;
}
export declare function errorHandler(options?: ErrorHandlerOptions): MiddlewareHandler;
type AsyncHandler = (req: CanxRequest, res: CanxResponse) => Promise<Response>;
export declare function asyncHandler(fn: AsyncHandler): AsyncHandler;
export declare function assertFound<T>(value: T | null | undefined, resource?: string, id?: string | number): T;
export declare function assertAuthenticated<T>(user: T | null | undefined): T;
export declare function assertAuthorized(condition: boolean, message?: string): void;
export declare function assertValid(valid: boolean, errors?: Map<string, string[]> | Record<string, string[]>): void;
export declare const errors: {
    CanxError: typeof CanxError;
    ValidationError: typeof ValidationError;
    NotFoundError: typeof NotFoundError;
    AuthenticationError: typeof AuthenticationError;
    AuthorizationError: typeof AuthorizationError;
    ConflictError: typeof ConflictError;
    RateLimitError: typeof RateLimitError;
    BadRequestError: typeof BadRequestError;
    DatabaseError: typeof DatabaseError;
    ServiceUnavailableError: typeof ServiceUnavailableError;
};
declare const _default: {
    errorHandler: typeof errorHandler;
    asyncHandler: typeof asyncHandler;
    assertFound: typeof assertFound;
    assertAuthenticated: typeof assertAuthenticated;
    assertAuthorized: typeof assertAuthorized;
    assertValid: typeof assertValid;
    CanxError: typeof CanxError;
    ValidationError: typeof ValidationError;
    NotFoundError: typeof NotFoundError;
    AuthenticationError: typeof AuthenticationError;
    AuthorizationError: typeof AuthorizationError;
    ConflictError: typeof ConflictError;
    RateLimitError: typeof RateLimitError;
    BadRequestError: typeof BadRequestError;
    DatabaseError: typeof DatabaseError;
    ServiceUnavailableError: typeof ServiceUnavailableError;
};
export default _default;
