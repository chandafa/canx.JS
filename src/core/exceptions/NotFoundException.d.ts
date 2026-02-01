import { HttpException } from './HttpException';
export declare class NotFoundException extends HttpException {
    constructor(resource?: string, id?: string | number);
}
