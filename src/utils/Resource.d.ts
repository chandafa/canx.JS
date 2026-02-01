/**
 * CanxJS Resource - API Resource transformers
 * Laravel-compatible JSON resources with TypeScript improvements
 */
import type { CanxRequest, CanxResponse } from '../types';
import { Paginator } from './Paginator';
export type ResourceData<T> = T | T[] | Paginator<T>;
export interface ResourceMeta {
    [key: string]: unknown;
}
export interface ResourceLinks {
    self?: string;
    [key: string]: string | undefined;
}
export interface ResourceResponse<T = unknown> {
    data: T;
    meta?: ResourceMeta;
    links?: ResourceLinks;
}
export declare abstract class JsonResource<T = unknown> {
    protected resource: T;
    protected request?: CanxRequest;
    protected additionalMeta: ResourceMeta;
    protected additionalLinks: ResourceLinks;
    protected withoutWrapping: boolean;
    constructor(resource: T);
    /**
     * Transform the resource into an array/object
     * Must be implemented in subclass
     */
    abstract toArray(request?: CanxRequest): Record<string, unknown>;
    /**
     * Add additional meta data
     */
    additional(meta: ResourceMeta): this;
    /**
     * Add additional links
     */
    withLinks(links: ResourceLinks): this;
    /**
     * Disable data wrapping
     */
    withoutWrappingData(): this;
    /**
     * Set the request for context
     */
    withRequest(request: CanxRequest): this;
    /**
     * Get the underlying resource
     */
    getResource(): T;
    /**
     * Transform to JSON response
     */
    toJSON(): ResourceResponse;
    /**
     * Create response
     */
    response(res: CanxResponse, status?: number): Response;
    /**
     * Create a collection of resources
     */
    static collection<R extends JsonResource<T>, T>(ResourceClass: new (resource: T) => R, items: T[]): ResourceCollection<R, T>;
}
export declare class ResourceCollection<R extends JsonResource<T>, T = unknown> {
    private ResourceClass;
    private items;
    private request?;
    private additionalMeta;
    private additionalLinks;
    private withoutWrapping;
    private isPaginated;
    private paginator?;
    constructor(ResourceClass: new (resource: T) => R, items: T[] | Paginator<T>);
    /**
     * Add additional meta data
     */
    additional(meta: ResourceMeta): this;
    /**
     * Add additional links
     */
    withLinks(links: ResourceLinks): this;
    /**
     * Disable data wrapping
     */
    withoutWrappingData(): this;
    /**
     * Set the request for context
     */
    withRequest(request: CanxRequest): this;
    /**
     * Transform each item
     */
    private transformItems;
    /**
     * Transform to JSON response
     */
    toJSON(): ResourceResponse<Record<string, unknown>[]>;
    /**
     * Create response
     */
    response(res: CanxResponse, status?: number): Response;
}
export declare class AnonymousResource<T = unknown> extends JsonResource<T> {
    private transformer;
    constructor(resource: T, transformer: (resource: T, request?: CanxRequest) => Record<string, unknown>);
    toArray(request?: CanxRequest): Record<string, unknown>;
}
/**
 * Create a resource from any data
 */
export declare function resource<T>(data: T, transformer: (resource: T, request?: CanxRequest) => Record<string, unknown>): AnonymousResource<T>;
/**
 * Create a collection of resources
 */
export declare function collection<R extends JsonResource<T>, T>(ResourceClass: new (resource: T) => R, items: T[] | Paginator<T>): ResourceCollection<R, T>;
/**
 * Create a simple JSON response wrapper
 */
export declare function wrap<T>(data: T, meta?: ResourceMeta): ResourceResponse<T>;
/**
 * Create a success response
 */
export declare function success<T>(data: T, message?: string): ResourceResponse<T> & {
    success: true;
    message?: string;
};
/**
 * Create an error response
 */
export declare function error(message: string, errors?: Record<string, string[]>): {
    success: false;
    error: string;
    errors?: Record<string, string[]>;
};
/**
 * Include attribute only when condition is true
 */
export declare function when<T>(condition: boolean, value: T | (() => T)): T | undefined;
/**
 * Include attribute only when it's not null
 */
export declare function whenNotNull<T>(value: T | null | undefined): T | undefined;
/**
 * Include attribute when callback returns true
 */
export declare function whenLoaded<T>(relation: string, resource: Record<string, unknown>, value: T | (() => T)): T | undefined;
/**
 * Merge attributes conditionally
 */
export declare function mergeWhen(condition: boolean, attributes: Record<string, unknown>): Record<string, unknown>;
export { JsonResource as Resource };
export default JsonResource;
