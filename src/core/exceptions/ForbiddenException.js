"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenException = void 0;
const HttpException_1 = require("./HttpException");
class ForbiddenException extends HttpException_1.HttpException {
    constructor(message = 'Forbidden') {
        super(message, 403);
        this.code = 'FORBIDDEN';
    }
}
exports.ForbiddenException = ForbiddenException;
