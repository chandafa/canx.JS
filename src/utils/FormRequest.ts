/**
 * CanxJS FormRequest - Validation + Authorization in one class
 * Laravel-compatible form requests with TypeScript improvements
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler, ValidationSchema, ValidationResult } from '../types';
import { validate as validateData } from '../utils/Validator';
import { gate } from '../auth/Gate';

// ============================================
// Types
// ============================================

export interface FormRequestOptions {
  /**
   * Stop on first validation failure
   */
  stopOnFirstFailure?: boolean;

  /**
   * Custom error messages
   */
  messages?: Record<string, string>;

  /**
   * Custom attribute names
   */
  attributes?: Record<string, string>;
}

// ============================================
// FormRequest Base Class
// ============================================

export abstract class FormRequest {
  protected request!: CanxRequest;
  protected response!: CanxResponse;
  protected user: unknown = null;
  protected validatedData: Record<string, unknown> = {};

  /**
   * Authorization check - override in subclass
   * Return true if user is authorized, false otherwise
   */
  authorize(): boolean | Promise<boolean> {
    return true;
  }

  /**
   * Validation rules - must be implemented in subclass
   */
  abstract rules(): ValidationSchema;

  /**
   * Custom error messages (optional)
   */
  messages(): Record<string, string> {
    return {};
  }

  /**
   * Custom attribute names (optional)
   */
  attributes(): Record<string, string> {
    return {};
  }

  /**
   * Prepare data before validation (optional)
   */
  prepareForValidation(data: Record<string, unknown>): Record<string, unknown> {
    return data;
  }

  /**
   * After validation hook (optional)
   */
  passedValidation(): void | Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Get validated data
   */
  validated<T = Record<string, unknown>>(): T {
    return this.validatedData as T;
  }

  /**
   * Get specific validated field
   */
  safe<T = unknown>(key: string, defaultValue?: T): T {
    return (this.validatedData[key] as T) ?? defaultValue as T;
  }

  /**
   * Get all input data
   */
  all(): Record<string, unknown> {
    return this.validatedData;
  }

  /**
   * Check if field exists in validated data
   */
  has(key: string): boolean {
    return key in this.validatedData;
  }

  /**
   * Get only specified fields
   */
  only(...keys: string[]): Record<string, unknown> {
    return keys.reduce((acc, key) => {
      if (key in this.validatedData) {
        acc[key] = this.validatedData[key];
      }
      return acc;
    }, {} as Record<string, unknown>);
  }

  /**
   * Get all except specified fields
   */
  except(...keys: string[]): Record<string, unknown> {
    return Object.entries(this.validatedData).reduce((acc, [key, value]) => {
      if (!keys.includes(key)) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, unknown>);
  }

  /**
   * Get the current user
   */
  getUser<T = unknown>(): T | null {
    return this.user as T | null;
  }

  // ============================================
  // Internal Methods
  // ============================================

  /**
   * Set request context (called by middleware)
   */
  setContext(req: CanxRequest, res: CanxResponse): void {
    this.request = req;
    this.response = res;
    this.user = req.user || req.context?.get('user');
  }

  /**
   * Run validation
   */
  async validate(data: Record<string, unknown>): Promise<ValidationResult> {
    // Prepare data
    const preparedData = this.prepareForValidation(data);
    
    // Run validation
    const result = validateData(preparedData, this.rules());
    
    if (result.valid) {
      this.validatedData = result.data;
      await this.passedValidation();
    }
    
    return result;
  }

  /**
   * Run authorization check
   */
  async checkAuthorization(): Promise<boolean> {
    return await this.authorize();
  }
}

// ============================================
// FormRequest Middleware Factory
// ============================================

/**
 * Create middleware from FormRequest class
 */
export function formRequest<T extends FormRequest>(
  FormRequestClass: new () => T
): MiddlewareHandler {
  return async (req, res, next) => {
    const formRequest = new FormRequestClass();
    formRequest.setContext(req, res);

    // Check authorization
    const authorized = await formRequest.checkAuthorization();
    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to perform this action.',
      });
    }

    // Get request data
    let data: Record<string, unknown> = {};
    
    try {
      if (req.method === 'GET') {
        data = Object.fromEntries(
          Object.entries(req.query).map(([k, v]) => [k, v])
        );
      } else {
        data = await req.json();
      }
    } catch {
      // If JSON parsing fails, try form data
      try {
        const formData = await req.formData();
        formData.forEach((value, key) => {
          data[key] = value;
        });
      } catch {
        data = {};
      }
    }

    // Merge with route params
    data = { ...data, ...req.params };

    // Validate
    const result = await formRequest.validate(data);
    
    if (!result.valid) {
      return res.status(422).json({
        success: false,
        error: 'Validation Failed',
        errors: Object.fromEntries(result.errors),
      });
    }

    // Attach validated data and form request to request context
    req.context.set('validated', formRequest.validated());
    req.context.set('formRequest', formRequest);

    return next();
  };
}

/**
 * Helper to get validated data from request
 */
export function validated<T = Record<string, unknown>>(req: CanxRequest): T {
  return req.context.get('validated') as T;
}

/**
 * Helper to get FormRequest instance from request
 */
export function getFormRequest<T extends FormRequest>(req: CanxRequest): T {
  return req.context.get('formRequest') as T;
}

// ============================================
// Common FormRequest Examples
// ============================================

/**
 * Create a simple FormRequest from rules object
 */
export function createFormRequest(
  rules: ValidationSchema,
  options?: {
    authorize?: (user: unknown) => boolean | Promise<boolean>;
    messages?: Record<string, string>;
  }
): new () => FormRequest {
  return class extends FormRequest {
    rules(): ValidationSchema {
      return rules;
    }

    authorize(): boolean | Promise<boolean> {
      if (options?.authorize) {
        return options.authorize(this.user);
      }
      return true;
    }

    messages(): Record<string, string> {
      return options?.messages || {};
    }
  };
}

// ============================================
// Decorator for FormRequest
// ============================================

/**
 * Decorator to apply FormRequest validation to controller method
 */
export function ValidateWith<T extends FormRequest>(
  FormRequestClass: new () => T
): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(req: CanxRequest, res: CanxResponse) {
      const formRequest = new FormRequestClass();
      formRequest.setContext(req, res);

      // Check authorization
      const authorized = await formRequest.checkAuthorization();
      if (!authorized) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You are not authorized to perform this action.',
        });
      }

      // Get data
      let data: Record<string, unknown> = {};
      try {
        if (req.method === 'GET') {
          data = Object.fromEntries(Object.entries(req.query));
        } else {
          data = await req.json();
        }
      } catch {
        data = {};
      }
      data = { ...data, ...req.params };

      // Validate
      const result = await formRequest.validate(data);
      if (!result.valid) {
        return res.status(422).json({
          success: false,
          error: 'Validation Failed',
          errors: Object.fromEntries(result.errors),
        });
      }

      // Attach to context
      req.context.set('validated', formRequest.validated());
      req.context.set('formRequest', formRequest);

      return originalMethod.call(this, req, res);
    };
    
    return descriptor;
  };
}

export default FormRequest;
