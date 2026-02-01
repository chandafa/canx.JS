/**
 * CanxJS FormRequest - Validation + Authorization in one class
 * Laravel-compatible form requests with TypeScript improvements
 */
import type { CanxRequest, CanxResponse, MiddlewareHandler, ValidationSchema, ValidationResult } from '../types';
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
export declare abstract class FormRequest {
    protected request: CanxRequest;
    protected response: CanxResponse;
    protected user: unknown;
    protected validatedData: Record<string, unknown>;
    /**
     * Authorization check - override in subclass
     * Return true if user is authorized, false otherwise
     */
    authorize(): boolean | Promise<boolean>;
    /**
     * Validation rules - must be implemented in subclass
     */
    abstract rules(): ValidationSchema;
    /**
     * Custom error messages (optional)
     */
    messages(): Record<string, string>;
    /**
     * Custom attribute names (optional)
     */
    attributes(): Record<string, string>;
    /**
     * Prepare data before validation (optional)
     */
    prepareForValidation(data: Record<string, unknown>): Record<string, unknown>;
    /**
     * After validation hook (optional)
     */
    passedValidation(): void | Promise<void>;
    /**
     * Get validated data
     */
    validated<T = Record<string, unknown>>(): T;
    /**
     * Get specific validated field
     */
    safe<T = unknown>(key: string, defaultValue?: T): T;
    /**
     * Get all input data
     */
    all(): Record<string, unknown>;
    /**
     * Check if field exists in validated data
     */
    has(key: string): boolean;
    /**
     * Get only specified fields
     */
    only(...keys: string[]): Record<string, unknown>;
    /**
     * Get all except specified fields
     */
    except(...keys: string[]): Record<string, unknown>;
    /**
     * Get the current user
     */
    getUser<T = unknown>(): T | null;
    /**
     * Set request context (called by middleware)
     */
    setContext(req: CanxRequest, res: CanxResponse): void;
    /**
     * Run validation
     */
    validate(data: Record<string, unknown>): Promise<ValidationResult>;
    /**
     * Run authorization check
     */
    checkAuthorization(): Promise<boolean>;
}
/**
 * Create middleware from FormRequest class
 */
export declare function formRequest<T extends FormRequest>(FormRequestClass: new () => T): MiddlewareHandler;
/**
 * Helper to get validated data from request
 */
export declare function validated<T = Record<string, unknown>>(req: CanxRequest): T;
/**
 * Helper to get FormRequest instance from request
 */
export declare function getFormRequest<T extends FormRequest>(req: CanxRequest): T;
/**
 * Create a simple FormRequest from rules object
 */
export declare function createFormRequest(rules: ValidationSchema, options?: {
    authorize?: (user: unknown) => boolean | Promise<boolean>;
    messages?: Record<string, string>;
}): new () => FormRequest;
/**
 * Decorator to apply FormRequest validation to controller method
 */
export declare function ValidateWith<T extends FormRequest>(FormRequestClass: new () => T): MethodDecorator;
export default FormRequest;
