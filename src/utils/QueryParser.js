"use strict";
/**
 * CanxJS Query Parser
 * Advanced API query parameters parsing (Sort, Filter, Pagination, Include)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryParser = void 0;
exports.parseQuery = parseQuery;
exports.QueryParams = QueryParams;
// ============================================
// Query Parser Class
// ============================================
class QueryParser {
    query;
    constructor(query) {
        this.query = query;
    }
    /**
     * Parse all query parameters
     */
    parse() {
        return {
            filters: this.parseFilters(),
            sort: this.parseSort(),
            page: this.parsePage(),
            limit: this.parseLimit(),
            include: this.parseInclude(),
            fields: this.parseFields(),
        };
    }
    /**
     * Parse filters (e.g. ?filter[status]=active or ?status=active)
     */
    parseFilters() {
        const filters = {};
        const reserved = ['sort', 'page', 'limit', 'per_page', 'include', 'fields', 'access_token', 'api_key'];
        // Handle filter[...] format
        if (this.query.filter && typeof this.query.filter === 'object') {
            Object.assign(filters, this.query.filter);
        }
        // Handle top-level parameters as filters if not reserved
        for (const [key, value] of Object.entries(this.query)) {
            if (!reserved.includes(key) && key !== 'filter') {
                filters[key] = value;
            }
        }
        // Parse operators like [gte], [like] etc. if needed
        // This basic version assumes direct equality or let the ORM handle advanced structures passed as objects
        return filters;
    }
    /**
     * Parse sort parameters (e.g. ?sort=-created_at,name)
     */
    parseSort() {
        const sort = this.query.sort;
        if (!sort)
            return [];
        const fields = String(sort).split(',');
        return fields.map(field => {
            const order = field.startsWith('-') ? 'desc' : 'asc';
            const cleanField = field.replace(/^-/, '');
            return { field: cleanField, order };
        });
    }
    /**
     * Parse page number
     */
    parsePage() {
        const page = Number(this.query.page);
        return !isNaN(page) && page > 0 ? page : 1;
    }
    /**
     * Parse items per page limit
     */
    parseLimit(defaultLimit = 15, maxLimit = 100) {
        let limit = Number(this.query.limit || this.query.per_page);
        if (isNaN(limit) || limit < 1)
            limit = defaultLimit;
        if (limit > maxLimit)
            limit = maxLimit;
        return limit;
    }
    /**
     * Parse relations to include (e.g. ?include=posts,profile)
     */
    parseInclude() {
        const include = this.query.include;
        if (!include)
            return [];
        return String(include).split(',');
    }
    /**
     * Parse fields to select (e.g. ?fields=id,name)
     */
    parseFields() {
        const fields = this.query.fields;
        if (!fields)
            return [];
        return String(fields).split(',');
    }
}
exports.QueryParser = QueryParser;
// ============================================
// Helper Functions
// ============================================
/**
 * Parse request query
 */
function parseQuery(req) {
    // CanxRequest usually has parsed query in .query
    // If not, we might need to parse URL
    const query = req.query || {};
    return new QueryParser(query).parse();
}
const queryParamsMetadata = new Map();
/**
 * Decorator to inject parsed query options
 */
function QueryParams() {
    return function (target, propertyKey, parameterIndex) {
        const key = target;
        const existing = queryParamsMetadata.get(key) || [];
        existing.push(parameterIndex);
        queryParamsMetadata.set(key, existing);
    };
}
exports.default = QueryParser;
