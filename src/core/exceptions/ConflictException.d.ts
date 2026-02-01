import { HttpException } from './HttpException';
export declare class ConflictException extends HttpException {
    constructor(message?: string, resource?: string);
}
