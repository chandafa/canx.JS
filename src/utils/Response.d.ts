/**
 * CanxJS Response - Enhanced response utilities
 */
import type { CookieOptions } from '../types';
export declare class ResponseBuilder {
    private statusCode;
    private headers;
    private cookies;
    status(code: number): this;
    header(name: string, value: string): this;
    cookie(name: string, value: string, options?: CookieOptions): this;
    private finalize;
    json<T>(data: T): Response;
    html(content: string): Response;
    text(content: string): Response;
    redirect(url: string, status?: 301 | 302 | 303 | 307 | 308): Response;
    file(path: string): Promise<Response>;
    download(path: string, filename?: string): Promise<Response>;
    stream(readable: ReadableStream): Response;
    sse(generator: AsyncGenerator<string>): Response;
    empty(status?: number): Response;
}
export declare function response(): ResponseBuilder;
export default ResponseBuilder;
