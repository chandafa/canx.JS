"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundException = void 0;
const HttpException_1 = require("./HttpException");
class NotFoundException extends HttpException_1.HttpException {
    constructor(resource = 'Resource', id) {
        const message = id ? `${resource} with ID ${id} not found` : resource;
        super(message, 404);
        this.code = 'NOT_FOUND';
    }
}
exports.NotFoundException = NotFoundException;
