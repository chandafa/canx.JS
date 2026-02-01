import { HttpException } from './HttpException';
export declare class MethodNotAllowedException extends HttpException {
    allowedMethods: string[];
    constructor(allowedMethods?: string[], message?: string);
}
