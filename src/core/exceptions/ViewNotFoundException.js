"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewNotFoundException = void 0;
const HttpException_1 = require("./HttpException");
class ViewNotFoundException extends HttpException_1.HttpException {
    viewPath;
    searchedPaths;
    constructor(viewPath, searchedPaths = []) {
        super(`View not found: ${viewPath}`, 404);
        this.code = 'VIEW_NOT_FOUND';
        this.viewPath = viewPath;
        this.searchedPaths = searchedPaths;
    }
}
exports.ViewNotFoundException = ViewNotFoundException;
