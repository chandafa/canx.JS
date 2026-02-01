export declare class CanxException extends Error {
    status: number;
    code: string;
    details?: any;
    timestamp: Date;
    constructor(message: string, status?: number, code?: string, details?: any);
    get statusCode(): number;
}
