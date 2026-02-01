import { HttpException } from './HttpException';
export declare class ServiceUnavailableException extends HttpException {
    retryAfter?: number;
    constructor(service?: string, message?: string);
}
