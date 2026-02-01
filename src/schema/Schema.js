"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.z = exports.Schema = void 0;
const ValidationException_1 = require("../core/exceptions/ValidationException");
class Schema {
    _output;
    _input;
    description;
    isOptional = false;
    safeParse(value) {
        try {
            const data = this.parse(value);
            return { success: true, data };
        }
        catch (error) {
            if (error instanceof ValidationException_1.ValidationException) {
                return { success: false, error };
            }
            throw error;
        }
    }
    optional() {
        const newSchema = Object.create(this);
        newSchema.isOptional = true;
        return newSchema;
    }
    describe(description) {
        this.description = description;
        return this;
    }
}
exports.Schema = Schema;
// ============================================
// String Schema
// ============================================
class StringSchema extends Schema {
    checks = [];
    constructor() {
        super();
    }
    min(length, message) {
        this.checks.push((v) => v.length >= length ? null : (message || `String must contain at least ${length} character(s)`));
        return this;
    }
    max(length, message) {
        this.checks.push((v) => v.length <= length ? null : (message || `String must contain at most ${length} character(s)`));
        return this;
    }
    email(message) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        this.checks.push((v) => emailRegex.test(v) ? null : (message || 'Invalid email address'));
        return this;
    }
    parse(value) {
        if (this.isOptional && (value === undefined || value === null)) {
            return value;
        }
        if (typeof value !== 'string') {
            throw new ValidationException_1.ValidationException({ _errors: ['Expected string, received ' + typeof value] });
        }
        for (const check of this.checks) {
            const error = check(value);
            if (error) {
                throw new ValidationException_1.ValidationException({ _errors: [error] });
            }
        }
        return value;
    }
    getJsonSchema() {
        return {
            type: 'string',
            description: this.description,
        };
    }
}
// ============================================
// Number Schema
// ============================================
class NumberSchema extends Schema {
    checks = [];
    min(min, message) {
        this.checks.push((v) => v >= min ? null : (message || `Number must be greater than or equal to ${min}`));
        return this;
    }
    max(max, message) {
        this.checks.push((v) => v <= max ? null : (message || `Number must be less than or equal to ${max}`));
        return this;
    }
    parse(value) {
        if (this.isOptional && (value === undefined || value === null)) {
            return value;
        }
        if (typeof value !== 'number' || isNaN(value)) {
            // Try converting string number
            if (typeof value === 'string' && !isNaN(parseFloat(value))) {
                const num = parseFloat(value);
                return this.validateChecks(num);
            }
            throw new ValidationException_1.ValidationException({ _errors: ['Expected number, received ' + typeof value] });
        }
        return this.validateChecks(value);
    }
    validateChecks(value) {
        for (const check of this.checks) {
            const error = check(value);
            if (error) {
                throw new ValidationException_1.ValidationException({ _errors: [error] });
            }
        }
        return value;
    }
    getJsonSchema() {
        return {
            type: 'number',
            description: this.description,
        };
    }
}
// ============================================
// Boolean Schema
// ============================================
class BooleanSchema extends Schema {
    parse(value) {
        if (this.isOptional && (value === undefined || value === null)) {
            return value;
        }
        if (typeof value === 'boolean')
            return value;
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        throw new ValidationException_1.ValidationException({ _errors: ['Expected boolean, received ' + typeof value] });
    }
    getJsonSchema() {
        return {
            type: 'boolean',
            description: this.description,
        };
    }
}
// ============================================
// Object Schema
// ============================================
class ObjectSchema extends Schema {
    shape;
    constructor(shape) {
        super();
        this.shape = shape;
    }
    parse(value) {
        if (this.isOptional && (value === undefined || value === null)) {
            return value;
        }
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new ValidationException_1.ValidationException({ _errors: ['Expected object, received ' + typeof value] });
        }
        const result = {};
        const errors = new Map();
        for (const [key, schema] of Object.entries(this.shape)) {
            try {
                result[key] = schema.parse(value[key]);
            }
            catch (err) {
                if (err instanceof ValidationException_1.ValidationException) {
                    const fieldErrors = err.errors.get('_errors') || [];
                    // If the child error has map errors (nested object), merge them
                    if (err.errors.size > 0 && !err.errors.has('_errors')) {
                        err.errors.forEach((msgs, path) => {
                            errors.set(`${key}.${path}`, msgs);
                        });
                    }
                    else {
                        errors.set(key, fieldErrors);
                    }
                }
                else {
                    errors.set(key, ['Invalid value']);
                }
            }
        }
        if (errors.size > 0) {
            throw new ValidationException_1.ValidationException(errors);
        }
        return result;
    }
    getJsonSchema() {
        const properties = {};
        const required = [];
        for (const [key, schema] of Object.entries(this.shape)) {
            properties[key] = schema.getJsonSchema();
            if (!schema.isOptional) {
                // Actually we can check isOptional property
                if (!schema.isOptional) {
                    required.push(key);
                }
            }
        }
        return {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined,
            description: this.description,
        };
    }
}
// ============================================
// Array Schema
// ============================================
class ArraySchema extends Schema {
    element;
    constructor(element) {
        super();
        this.element = element;
    }
    parse(value) {
        if (this.isOptional && (value === undefined || value === null)) {
            return value;
        }
        if (!Array.isArray(value)) {
            throw new ValidationException_1.ValidationException({ _errors: ['Expected array, received ' + typeof value] });
        }
        return value.map((item, index) => {
            try {
                return this.element.parse(item);
            }
            catch (err) {
                if (err instanceof ValidationException_1.ValidationException) {
                    throw new ValidationException_1.ValidationException({ [index]: err.errors.get('_errors') || ['Invalid Item'] });
                }
                throw err;
            }
        });
    }
    getJsonSchema() {
        return {
            type: 'array',
            items: this.element.getJsonSchema(),
            description: this.description,
        };
    }
}
// ============================================
// Builder
// ============================================
exports.z = {
    string: () => new StringSchema(),
    number: () => new NumberSchema(),
    boolean: () => new BooleanSchema(),
    object: (shape) => new ObjectSchema(shape),
    array: (element) => new ArraySchema(element),
};
