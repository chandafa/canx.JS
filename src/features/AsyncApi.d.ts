/**
 * CanxJS AsyncAPI - Event-Driven Architecture Documentation
 * Support for AsyncAPI 2.6 specification generation
 */
import 'reflect-metadata';
export interface AsyncApiInfo {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: {
        name?: string;
        url?: string;
        email?: string;
    };
    license?: {
        name: string;
        url?: string;
    };
}
export interface AsyncApiServer {
    url: string;
    protocol: string;
    description?: string;
    security?: Record<string, any>[];
}
export interface AsyncApiOptions {
    info: AsyncApiInfo;
    servers?: Record<string, AsyncApiServer>;
    defaultContentType?: string;
}
export interface ChannelOptions {
    name: string;
    description?: string;
    publish?: boolean;
    subscribe?: boolean;
}
export interface MessageOptions {
    name?: string;
    payload: any;
    summary?: string;
}
export declare function AsyncApiChannel(options: ChannelOptions): MethodDecorator;
export declare function AsyncApiMessage(options: MessageOptions): MethodDecorator;
export declare class AsyncApiGenerator {
    static createDocument(app: any, options: AsyncApiOptions): any;
}
