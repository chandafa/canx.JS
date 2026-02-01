/**
 * CanxJS Validator - Request validation with schema support
 */
import type { ValidationSchema, ValidationResult } from '../types';
export declare function validate(data: Record<string, unknown>, schema: ValidationSchema): ValidationResult;
export declare function validateAsync(data: Record<string, unknown>, schema: ValidationSchema): Promise<ValidationResult>;
export declare const is: {
    email: (v: string) => boolean;
    url: (v: string) => boolean;
    uuid: (v: string) => boolean;
    date: (v: string) => boolean;
    number: (v: unknown) => boolean;
    string: (v: unknown) => boolean;
    array: (v: unknown) => boolean;
    object: (v: unknown) => boolean;
};
type SyncValidatorFn = (value: unknown, param?: string) => boolean;
type AsyncExtendFn = (value: unknown, param?: string) => Promise<boolean>;
/**
 * Extend the validator with a custom rule (sync)
 * @example
 * extend('phone', (value) => /^\+?[0-9]{10,15}$/.test(String(value)), 'Field {field} must be a valid phone number');
 */
export declare function extend(name: string, validator: SyncValidatorFn, message?: string): void;
/**
 * Extend the validator with a custom async rule
 * @example
 * extendAsync('available', async (value) => {
 *   const result = await checkAvailability(value);
 *   return result.available;
 * }, 'Field {field} is not available');
 */
export declare function extendAsync(name: string, validator: AsyncExtendFn, message?: string): void;
/**
 * Extend the validator with a parameterized rule
 * @example
 * extendParam('digits', (value, param) => /^\d+$/.test(String(value)) && String(value).length === Number(param), 'Field {field} must be {param} digits');
 */
export declare function extendParam(name: string, validator: (value: unknown, param: string) => boolean, message?: string): void;
/**
 * Get all registered validators
 */
export declare function getValidators(): {
    sync: Record<string, SyncValidatorFn>;
    async: Record<string, AsyncExtendFn>;
    param: Record<string, (value: unknown, param: string) => boolean>;
};
/**
 * Set a custom message for an existing rule
 */
export declare function setMessage(rule: string, message: string): void;
declare const _default: {
    validate: typeof validate;
    validateAsync: typeof validateAsync;
    is: {
        email: (v: string) => boolean;
        url: (v: string) => boolean;
        uuid: (v: string) => boolean;
        date: (v: string) => boolean;
        number: (v: unknown) => boolean;
        string: (v: unknown) => boolean;
        array: (v: unknown) => boolean;
        object: (v: unknown) => boolean;
    };
    extend: typeof extend;
    extendAsync: typeof extendAsync;
    extendParam: typeof extendParam;
    getValidators: typeof getValidators;
    setMessage: typeof setMessage;
};
export default _default;
