import { CanxException } from './CanxException';
export declare class HttpException extends CanxException {
    constructor(message: string, status?: number);
}
