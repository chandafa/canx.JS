"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceUnavailableException = void 0;
const HttpException_1 = require("./HttpException");
class ServiceUnavailableException extends HttpException_1.HttpException {
    retryAfter;
    constructor(service = 'Service Unavailable', message) {
        const fullMessage = message ? `${service}: ${message}` : service;
        super(fullMessage, 503);
        this.code = 'SERVICE_UNAVAILABLE';
    }
}
exports.ServiceUnavailableException = ServiceUnavailableException;
