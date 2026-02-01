"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictException = void 0;
const HttpException_1 = require("./HttpException");
class ConflictException extends HttpException_1.HttpException {
    constructor(message = 'Conflict', resource) {
        const fullMessage = resource ? `${resource}: ${message}` : message;
        super(fullMessage, 409);
        this.code = 'CONFLICT';
    }
}
exports.ConflictException = ConflictException;
