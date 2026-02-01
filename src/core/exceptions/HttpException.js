"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpException = void 0;
const CanxException_1 = require("./CanxException");
class HttpException extends CanxException_1.CanxException {
    constructor(message, status = 500) {
        super(message, status, `HTTP_${status}`);
    }
}
exports.HttpException = HttpException;
