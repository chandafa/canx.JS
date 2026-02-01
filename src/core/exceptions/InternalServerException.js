"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerException = void 0;
const HttpException_1 = require("./HttpException");
class InternalServerException extends HttpException_1.HttpException {
    constructor(message = 'Internal Server Error') {
        super(message, 500);
        this.code = 'INTERNAL_SERVER_ERROR';
    }
}
exports.InternalServerException = InternalServerException;
