"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationException = void 0;
const CanxException_1 = require("./CanxException");
class ValidationException extends CanxException_1.CanxException {
    /**
     * Validation errors as a Map for compatibility with Schema validation
     */
    errors;
    constructor(errors) {
        const errorRecord = errors instanceof Map ? Object.fromEntries(errors) : errors;
        super("Validation Failed", 422, "VALIDATION_ERROR", errorRecord);
        this.errors =
            errors instanceof Map ? errors : new Map(Object.entries(errors));
    }
}
exports.ValidationException = ValidationException;
