/**
 * CanxJS Request - Enhanced request utilities
 */
import type { HttpMethod, QueryParams } from '../types';
export declare class RequestParser {
    private raw;
    private url;
    private _cookies;
    private _body;
    private _bodyParsed;
    constructor(raw: Request);
    get method(): HttpMethod;
    get path(): string;
    get headers(): Headers;
    get query(): QueryParams;
    get cookies(): Map<string, string>;
    header(name: string): string | null;
    cookie(name: string): string | undefined;
    body<T = unknown>(): Promise<T>;
    json<T = unknown>(): Promise<T>;
    formData(): Promise<FormData>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    files(): Promise<Map<string, File>>;
    get ip(): string;
    get userAgent(): string | null;
    get isAjax(): boolean;
    get isSecure(): boolean;
    get accepts(): string[];
}
export declare function parseRequest(raw: Request): RequestParser;
export default RequestParser;
