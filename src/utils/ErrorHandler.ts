/**
 * CanxJS Error Handler - Custom error classes and error handling utilities
 */

// ============================================
// Custom Error Classes
// ============================================

export class CanxError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string = 'CANX_ERROR',
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CanxError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

export class ValidationError extends CanxError {
  public readonly errors: Map<string, string[]>;

  constructor(errors: Map<string, string[]> | Record<string, string[]>, message = 'Validation failed') {
    const errorMap = errors instanceof Map ? errors : new Map(Object.entries(errors));
    super(message, 'VALIDATION_ERROR', 422, { errors: Object.fromEntries(errorMap) });
    this.name = 'ValidationError';
    this.errors = errorMap;
  }
}

export class NotFoundError extends CanxError {
  constructor(resource: string = 'Resource', id?: string | number) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class AuthenticationError extends CanxError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends CanxError {
  constructor(message = 'You do not have permission to access this resource') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class ConflictError extends CanxError {
  constructor(message = 'Resource conflict', resource?: string) {
    super(message, 'CONFLICT_ERROR', 409, { resource });
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends CanxError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60, message = 'Too many requests') {
    super(message, 'RATE_LIMIT_ERROR', 429, { retryAfter });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class BadRequestError extends CanxError {
  constructor(message = 'Bad request') {
    super(message, 'BAD_REQUEST', 400);
    this.name = 'BadRequestError';
  }
}

export class DatabaseError extends CanxError {
  constructor(message = 'Database error', originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500, { 
      originalMessage: originalError?.message,
      stack: originalError?.stack 
    });
    this.name = 'DatabaseError';
  }
}

export class ServiceUnavailableError extends CanxError {
  constructor(service: string, message?: string) {
    super(message || `Service ${service} is currently unavailable`, 'SERVICE_UNAVAILABLE', 503, { service });
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
      if (logErrors) {
        console.error(`[CanxJS Error] ${req.method} ${req.path}:`, error);
      }

      if (options.onError) {
        options.onError(error as Error, req);
      }

      const isJson = req.header('accept')?.includes('application/json') ?? true; // Default to JSON
      
      let statusCode = 500;
      let errorResponse: any = {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      };

      if (error instanceof CanxError) {
        statusCode = error.statusCode;
        errorResponse = {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        };
      } else {
         const unknownError = error as Error;
         errorResponse.message = showStack ? unknownError.message : 'Internal server error';
      }

      if (showStack && error instanceof Error) {
        errorResponse.stack = error.stack;
      }

      if (isJson) {
        return res.status(statusCode).json({ error: errorResponse });
      } else {
        // Fallback HTML error page
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Error ${statusCode}</title>
              <style>
                body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
                .error-box { background: #fee2e2; color: #991b1b; padding: 1.5rem; border-radius: 0.5rem; }
                pre { background: #f1f5f9; padding: 1rem; overflow-x: auto; border-radius: 0.5rem; }
              </style>
            </head>
            <body>
              <h1>Error ${statusCode}</h1>
              <div class="error-box">
                <p><strong>${errorResponse.code}</strong>: ${errorResponse.message}</p>
              </div>
              ${showStack && errorResponse.stack ? `<pre>${errorResponse.stack}</pre>` : ''}
            </body>
          </html>
        `;
        return res.status(statusCode).html(html);
      }
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
