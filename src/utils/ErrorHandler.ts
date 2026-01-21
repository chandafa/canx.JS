/**
 * CanxJS Error Handler - Custom error classes and error handling utilities
 */

// ============================================
// Custom Error Classes
// ============================================

import { ErrorHandler as CoreErrorHandler } from '../core/ErrorHandler';
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

export class CanxError extends CanxException {
  constructor(
    message: string,
    code: string = 'CANX_ERROR',
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
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

export class ValidationError extends ValidationException {
  constructor(errors: Map<string, string[]> | Record<string, string[]>, message = 'Validation failed') {
    const errorRecord = errors instanceof Map ? Object.fromEntries(errors) : errors;
    super(errorRecord);
    if (message !== 'Validation Failed') this.message = message;
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends CoreNotFoundException {
  constructor(resource: string = 'Resource', id?: string | number) {
    super(resource, id);
    this.name = 'NotFoundError';
  }
}

export class AuthenticationError extends UnauthorizedException {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ForbiddenException {
  constructor(message = 'You do not have permission to access this resource') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ConflictError extends ConflictException {
  constructor(message = 'Resource conflict', resource?: string) {
    super(message, resource); // ConflictException needs check if it accepts resource
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends TooManyRequestsException {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60, message = 'Too many requests') {
    super(message); // Check TooManyRequests signature
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class BadRequestError extends BadRequestException {
  constructor(message = 'Bad request') {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class DatabaseError extends InternalServerException {
  constructor(message = 'Database error', originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
    this.details = { 
      originalMessage: originalError?.message,
      stack: originalError?.stack 
    };
  }
}

export class ServiceUnavailableError extends CoreServiceUnavailableException {
  constructor(service: string, message?: string) {
    super(service, message);
    this.name = 'ServiceUnavailableError';
  }
}

// ============================================
// Error Handler Middleware
// ============================================

import type { MiddlewareHandler, CanxRequest, CanxResponse } from '../types';

interface ErrorHandlerOptions {
  showStack?: boolean;
  logErrors?: boolean;
  onError?: (error: Error, req: CanxRequest) => void;
}

export function errorHandler(options: ErrorHandlerOptions = {}): MiddlewareHandler {
  const { showStack = process.env.NODE_ENV !== 'production', logErrors = true } = options;

  return async (req, res, next) => {
    try {
      return await next();
    } catch (error) {
       // Delegate to Core ErrorHandler implementation
       const response = await CoreErrorHandler.handle(error as Error, req.raw || req as any, !logErrors); 
       // Note: CoreErrorHandler uses Request, CanxRequest extends Request.
       // However, CoreErrorHandler logs it too.
       // The original middleware has 'logErrors' option. CoreErrorHandler has built-in logging.
       // We might need to adjust options.
       
       return response;
    }
  };
}


// ============================================
// Async Error Wrapper
// ============================================

type AsyncHandler = (req: CanxRequest, res: CanxResponse) => Promise<Response>;

export function asyncHandler(fn: AsyncHandler): AsyncHandler {
  return async (req, res) => {
    try {
      return await fn(req, res);
    } catch (error) {
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

export function assertFound<T>(value: T | null | undefined, resource = 'Resource', id?: string | number): T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource, id);
  }
  return value;
}

export function assertAuthenticated<T>(user: T | null | undefined): T {
  if (!user) {
    throw new AuthenticationError();
  }
  return user;
}

export function assertAuthorized(condition: boolean, message?: string): void {
  if (!condition) {
    throw new AuthorizationError(message);
  }
}

export function assertValid(valid: boolean, errors?: Map<string, string[]> | Record<string, string[]>): void {
  if (!valid) {
    throw new ValidationError(errors || new Map());
  }
}

// ============================================
// Export
// ============================================

export const errors = {
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

export default {
  ...errors,
  errorHandler,
  asyncHandler,
  assertFound,
  assertAuthenticated,
  assertAuthorized,
  assertValid,
};
