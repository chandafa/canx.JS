"use strict";
/**
 * CanxJS FormRequest - Validation + Authorization in one class
 * Laravel-compatible form requests with TypeScript improvements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormRequest = void 0;
exports.formRequest = formRequest;
exports.validated = validated;
exports.getFormRequest = getFormRequest;
exports.createFormRequest = createFormRequest;
exports.ValidateWith = ValidateWith;
const Validator_1 = require("../utils/Validator");
// ============================================
// FormRequest Base Class
// ============================================
class FormRequest {
    request;
    response;
    user = null;
    validatedData = {};
    /**
     * Authorization check - override in subclass
     * Return true if user is authorized, false otherwise
     */
    authorize() {
        return true;
    }
    /**
     * Custom error messages (optional)
     */
    messages() {
        return {};
    }
    /**
     * Custom attribute names (optional)
     */
    attributes() {
        return {};
    }
    /**
     * Prepare data before validation (optional)
     */
    prepareForValidation(data) {
        return data;
    }
    /**
     * After validation hook (optional)
     */
    passedValidation() {
        // Override in subclass if needed
    }
    /**
     * Get validated data
     */
    validated() {
        return this.validatedData;
    }
    /**
     * Get specific validated field
     */
    safe(key, defaultValue) {
        return this.validatedData[key] ?? defaultValue;
    }
    /**
     * Get all input data
     */
    all() {
        return this.validatedData;
    }
    /**
     * Check if field exists in validated data
     */
    has(key) {
        return key in this.validatedData;
    }
    /**
     * Get only specified fields
     */
    only(...keys) {
        return keys.reduce((acc, key) => {
            if (key in this.validatedData) {
                acc[key] = this.validatedData[key];
            }
            return acc;
        }, {});
    }
    /**
     * Get all except specified fields
     */
    except(...keys) {
        return Object.entries(this.validatedData).reduce((acc, [key, value]) => {
            if (!keys.includes(key)) {
                acc[key] = value;
            }
            return acc;
        }, {});
    }
    /**
     * Get the current user
     */
    getUser() {
        return this.user;
    }
    // ============================================
    // Internal Methods
    // ============================================
    /**
     * Set request context (called by middleware)
     */
    setContext(req, res) {
        this.request = req;
        this.response = res;
        this.user = req.user || req.context?.get('user');
    }
    /**
     * Run validation
     */
    async validate(data) {
        // Prepare data
        const preparedData = this.prepareForValidation(data);
        // Run validation
        const result = (0, Validator_1.validate)(preparedData, this.rules());
        if (result.valid) {
            this.validatedData = result.data;
            await this.passedValidation();
        }
        return result;
    }
    /**
     * Run authorization check
     */
    async checkAuthorization() {
        return await this.authorize();
    }
}
exports.FormRequest = FormRequest;
// ============================================
// FormRequest Middleware Factory
// ============================================
/**
 * Create middleware from FormRequest class
 */
function formRequest(FormRequestClass) {
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
        let data = {};
        try {
            if (req.method === 'GET') {
                data = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, v]));
            }
            else {
                data = await req.json();
            }
        }
        catch {
            // If JSON parsing fails, try form data
            try {
                const formData = await req.formData();
                formData.forEach((value, key) => {
                    data[key] = value;
                });
            }
            catch {
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
function validated(req) {
    return req.context.get('validated');
}
/**
 * Helper to get FormRequest instance from request
 */
function getFormRequest(req) {
    return req.context.get('formRequest');
}
// ============================================
// Common FormRequest Examples
// ============================================
/**
 * Create a simple FormRequest from rules object
 */
function createFormRequest(rules, options) {
    return class extends FormRequest {
        rules() {
            return rules;
        }
        authorize() {
            if (options?.authorize) {
                return options.authorize(this.user);
            }
            return true;
        }
        messages() {
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
function ValidateWith(FormRequestClass) {
    return (target, propertyKey, descriptor) => {
        const originalMethod = descriptor.value;
        descriptor.value = async function (req, res) {
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
            let data = {};
            try {
                if (req.method === 'GET') {
                    data = Object.fromEntries(Object.entries(req.query));
                }
                else {
                    data = await req.json();
                }
            }
            catch {
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
exports.default = FormRequest;
