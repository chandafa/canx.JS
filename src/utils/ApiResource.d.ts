/**
 * CanxJS API Resources (Transformers)
 * Transform model data for API responses
 */
export interface ResourceMeta {
    links?: Record<string, string>;
    pagination?: {
        currentPage: number;
        lastPage: number;
        perPage: number;
        total: number;
        from: number;
        to: number;
    };
    [key: string]: unknown;
}
export interface ResourceOptions {
    wrap?: string | false;
    withMeta?: boolean;
    includes?: string[];
    excludes?: string[];
}
export declare abstract class Resource<T = unknown> {
    protected resource: T;
    protected includes: string[];
    protected excludes: string[];
    constructor(resource: T);
    /**
     * Define how to transform a single item
     * Override this in child classes
     */
    abstract toArray(): Record<string, unknown>;
    /**
     * Include additional fields
     */
    include(...fields: string[]): this;
    /**
     * Exclude fields from output
     */
    exclude(...fields: string[]): this;
    /**
     * Check if a field should be included
     */
    protected shouldInclude(field: string): boolean;
    /**
     * Apply includes/excludes to output
     */
    protected filterOutput(data: Record<string, unknown>): Record<string, unknown>;
    /**
     * Get transformed data
     */
    toJSON(): Record<string, unknown>;
    /**
     * Create response with wrapper
     */
    response(wrap?: string | false): Record<string, unknown>;
    /**
     * Static factory for collections
     */
    static collection<U, R extends Resource<U>>(this: new (item: U) => R, items: U[]): ResourceCollection<U, R>;
}
export declare class ResourceCollection<T, R extends Resource<T>> {
    private items;
    private ResourceClass;
    private meta;
    private collectionIncludes;
    private collectionExcludes;
    constructor(items: T[], ResourceClass: new (item: T) => R);
    /**
     * Add metadata to collection
     */
    withMeta(meta: ResourceMeta): this;
    /**
     * Add pagination metadata
     */
    withPagination(pagination: ResourceMeta['pagination']): this;
    /**
     * Include fields for all items
     */
    include(...fields: string[]): this;
    /**
     * Exclude fields for all items
     */
    exclude(...fields: string[]): this;
    /**
     * Transform all items
     */
    toArray(): Record<string, unknown>[];
    /**
     * Get response object
     */
    response(wrap?: string | false): Record<string, unknown>;
    /**
     * Get JSON (shorthand for response)
     */
    toJSON(): Record<string, unknown>;
}
export interface PaginatedData<T> {
    data: T[];
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
}
/**
 * Create paginated resource response
 */
export declare function paginatedResource<T, R extends Resource<T>>(paginated: PaginatedData<T>, ResourceClass: new (item: T) => R, baseUrl?: string): Record<string, unknown>;
/**
 * Include value only when condition is true
 */
export declare function when<T>(condition: boolean, value: T): T | undefined;
export declare function when<T>(condition: boolean, value: T, fallback: T): T;
/**
 * Include value only when it's not null/undefined
 */
export declare function whenNotNull<T>(value: T | null | undefined): T | undefined;
/**
 * Merge conditionally
 */
export declare function mergeWhen(condition: boolean, data: Record<string, unknown>): Record<string, unknown>;
/**
 * Create an anonymous resource from a transform function
 */
export declare function resource<T>(data: T, transform: (item: T) => Record<string, unknown>): Record<string, unknown>;
/**
 * Create anonymous collection resource
 */
export declare function collection<T>(items: T[], transform: (item: T) => Record<string, unknown>): Record<string, unknown>[];
