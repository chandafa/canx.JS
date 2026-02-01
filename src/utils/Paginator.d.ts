/**
 * CanxJS Paginator - Database pagination helper
 * Laravel-compatible pagination with improved API
 */
export interface PaginationMeta {
    currentPage: number;
    perPage: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}
export interface PaginatedResult<T> {
    data: T[];
    meta: PaginationMeta;
    links: PaginationLinks;
}
export interface PaginationLinks {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
    pages: PageLink[];
}
export interface PageLink {
    page: number;
    url: string;
    active: boolean;
}
export interface PaginatorOptions {
    path?: string;
    queryParam?: string;
    perPageParam?: string;
    surroundingPages?: number;
}
export declare class Paginator<T = unknown> {
    private items;
    private page;
    private perPage;
    private totalItems;
    private options;
    constructor(items: T[], total: number, page?: number, perPage?: number, options?: PaginatorOptions);
    /**
     * Get pagination result
     */
    toJSON(): PaginatedResult<T>;
    /**
     * Get pagination metadata
     */
    getMeta(): PaginationMeta;
    /**
     * Get pagination links
     */
    getLinks(): PaginationLinks;
    /**
     * Generate page links array
     */
    private generatePageLinks;
    /**
     * Generate URL for a page
     */
    private generateUrl;
    /**
     * Get paginated items
     */
    getItems(): T[];
    /**
     * Get current page
     */
    currentPage(): number;
    /**
     * Get items per page
     */
    getPerPage(): number;
    /**
     * Get total items count
     */
    total(): number;
    /**
     * Get total pages
     */
    lastPage(): number;
    /**
     * Check if there are more pages
     */
    hasMorePages(): boolean;
    /**
     * Get first item number on this page
     */
    firstItem(): number;
    /**
     * Get last item number on this page
     */
    lastItem(): number;
    /**
     * Convert to simple array
     */
    all(): T[];
    /**
     * Iterate over items
     */
    [Symbol.iterator](): Iterator<T>;
    /**
     * Map over items
     */
    map<U>(callback: (item: T, index: number) => U): U[];
    /**
     * Filter items
     */
    filter(callback: (item: T, index: number) => boolean): T[];
    /**
     * Check if empty
     */
    isEmpty(): boolean;
    /**
     * Check if not empty
     */
    isNotEmpty(): boolean;
}
export declare class SimplePaginator<T = unknown> {
    private items;
    private page;
    private perPage;
    private hasMore;
    private options;
    constructor(items: T[], page?: number, perPage?: number, hasMore?: boolean, options?: PaginatorOptions);
    toJSON(): {
        data: T[];
        meta: {
            currentPage: number;
            perPage: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
        links: {
            prev: string | null;
            next: string | null;
        };
    };
    private generateUrl;
    getItems(): T[];
    hasMorePages(): boolean;
}
export declare class CursorPaginator<T = unknown> {
    private items;
    private cursor;
    private nextCursor;
    private perPage;
    private options;
    constructor(items: T[], cursor: string | null, nextCursor: string | null, perPage?: number, options?: PaginatorOptions);
    toJSON(): {
        data: T[];
        meta: {
            perPage: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
            nextCursor: string | null;
            prevCursor: string | null;
        };
        links: {
            next: string | null;
        };
    };
    private generateUrl;
    getItems(): T[];
    hasMorePages(): boolean;
    getNextCursor(): string | null;
}
/**
 * Create a paginated result
 */
export declare function paginate<T>(items: T[], total: number, page?: number, perPage?: number, options?: PaginatorOptions): Paginator<T>;
/**
 * Create a simple paginated result (no total count)
 */
export declare function simplePaginate<T>(items: T[], page?: number, perPage?: number, hasMore?: boolean, options?: PaginatorOptions): SimplePaginator<T>;
/**
 * Create a cursor paginated result
 */
export declare function cursorPaginate<T>(items: T[], cursor: string | null, nextCursor: string | null, perPage?: number, options?: PaginatorOptions): CursorPaginator<T>;
export default Paginator;
