"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MethodNotAllowedException = void 0;
const HttpException_1 = require("./HttpException");
class MethodNotAllowedException extends HttpException_1.HttpException {
    allowedMethods;
    constructor(allowedMethods = [], message) {
        super(message || `Method not allowed. Allowed: ${allowedMethods.join(', ')}`, 405);
        this.code = 'METHOD_NOT_ALLOWED';
        this.allowedMethods = allowedMethods;
    }
}
exports.MethodNotAllowedException = MethodNotAllowedException;
