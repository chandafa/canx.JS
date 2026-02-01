/**
 * CanxJS Query Parser
 * Advanced API query parameters parsing (Sort, Filter, Pagination, Include)
 */
import type { CanxRequest } from '../types';
export interface QueryOptions {
    filters: Record<string, any>;
    sort: SortOption[];
    page: number;
    limit: number;
    include: string[];
    fields: string[];
}
export interface SortOption {
    field: string;
    order: 'asc' | 'desc';
}
export interface PaginationMeta {
    current_page: number;
    per_page: number;
    total?: number;
    last_page?: number;
    from?: number;
    to?: number;
}
export declare class QueryParser {
    private query;
    constructor(query: Record<string, any>);
    /**
     * Parse all query parameters
     */
    parse(): QueryOptions;
    /**
     * Parse filters (e.g. ?filter[status]=active or ?status=active)
     */
    parseFilters(): Record<string, any>;
    /**
     * Parse sort parameters (e.g. ?sort=-created_at,name)
     */
    parseSort(): SortOption[];
    /**
     * Parse page number
     */
    parsePage(): number;
    /**
     * Parse items per page limit
     */
    parseLimit(defaultLimit?: number, maxLimit?: number): number;
    /**
     * Parse relations to include (e.g. ?include=posts,profile)
     */
    parseInclude(): string[];
    /**
     * Parse fields to select (e.g. ?fields=id,name)
     */
    parseFields(): string[];
}
/**
 * Parse request query
 */
export declare function parseQuery(req: CanxRequest): QueryOptions;
/**
 * Decorator to inject parsed query options
 */
export declare function QueryParams(): ParameterDecorator;
export default QueryParser;
