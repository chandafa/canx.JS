"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TooManyRequestsException = void 0;
const HttpException_1 = require("./HttpException");
class TooManyRequestsException extends HttpException_1.HttpException {
    retryAfter;
    constructor(message = 'Too Many Requests', retryAfter) {
        super(message, 429);
        this.code = 'TOO_MANY_REQUESTS';
        this.retryAfter = retryAfter;
    }
}
exports.TooManyRequestsException = TooManyRequestsException;
