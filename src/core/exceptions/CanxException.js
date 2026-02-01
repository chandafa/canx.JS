"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanxException = void 0;
class CanxException extends Error {
    status;
    code;
    details;
    timestamp;
    constructor(message, status = 500, code = 'INTERNAL_ERROR', details) {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
        this.code = code;
        this.details = details;
        this.timestamp = new Date();
        Error.captureStackTrace(this, this.constructor);
    }
    get statusCode() {
        return this.status;
    }
}
exports.CanxException = CanxException;
