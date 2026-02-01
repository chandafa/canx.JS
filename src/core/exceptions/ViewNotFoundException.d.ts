import { HttpException } from './HttpException';
export declare class ViewNotFoundException extends HttpException {
    viewPath: string;
    searchedPaths: string[];
    constructor(viewPath: string, searchedPaths?: string[]);
}
