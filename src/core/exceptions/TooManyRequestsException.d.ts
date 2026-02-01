import { HttpException } from './HttpException';
export declare class TooManyRequestsException extends HttpException {
    retryAfter?: number;
    constructor(message?: string, retryAfter?: number);
}
