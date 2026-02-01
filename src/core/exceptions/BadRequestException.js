"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadRequestException = void 0;
const HttpException_1 = require("./HttpException");
class BadRequestException extends HttpException_1.HttpException {
    constructor(message = 'Bad Request') {
        super(message, 400);
        this.code = 'BAD_REQUEST';
    }
}
exports.BadRequestException = BadRequestException;
