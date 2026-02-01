"use strict";
/**
 * CanxJS Paginator - Database pagination helper
 * Laravel-compatible pagination with improved API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorPaginator = exports.SimplePaginator = exports.Paginator = void 0;
exports.paginate = paginate;
exports.simplePaginate = simplePaginate;
exports.cursorPaginate = cursorPaginate;
// ============================================
// Paginator Class
// ============================================
class Paginator {
    items;
    page;
    perPage;
    totalItems;
    options;
    constructor(items, total, page = 1, perPage = 15, options = {}) {
        this.items = items;
        this.totalItems = total;
        this.page = Math.max(1, page);
        this.perPage = Math.max(1, perPage);
        this.options = {
            path: '/',
            queryParam: 'page',
            perPageParam: 'per_page',
            surroundingPages: 3,
            ...options,
        };
    }
    /**
     * Get pagination result
     */
    toJSON() {
        return {
            data: this.items,
            meta: this.getMeta(),
            links: this.getLinks(),
        };
    }
    /**
     * Get pagination metadata
     */
    getMeta() {
        const totalPages = Math.ceil(this.totalItems / this.perPage);
        const from = this.totalItems > 0 ? (this.page - 1) * this.perPage + 1 : 0;
        const to = Math.min(this.page * this.perPage, this.totalItems);
        return {
            currentPage: this.page,
            perPage: this.perPage,
            total: this.totalItems,
            totalPages,
            from,
            to,
            hasNextPage: this.page < totalPages,
            hasPrevPage: this.page > 1,
        };
    }
    /**
     * Get pagination links
     */
    getLinks() {
        const meta = this.getMeta();
        const pages = this.generatePageLinks(meta.totalPages);
        return {
            first: this.generateUrl(1),
            last: this.generateUrl(meta.totalPages),
            prev: meta.hasPrevPage ? this.generateUrl(this.page - 1) : null,
            next: meta.hasNextPage ? this.generateUrl(this.page + 1) : null,
            pages,
        };
    }
    /**
     * Generate page links array
     */
    generatePageLinks(totalPages) {
        const pages = [];
        const surrounding = this.options.surroundingPages;
        let start = Math.max(1, this.page - surrounding);
        let end = Math.min(totalPages, this.page + surrounding);
        // Adjust range if at edges
        if (this.page <= surrounding) {
            end = Math.min(totalPages, surrounding * 2 + 1);
        }
        if (this.page > totalPages - surrounding) {
            start = Math.max(1, totalPages - surrounding * 2);
        }
        // Add first page if not in range
        if (start > 1) {
            pages.push({ page: 1, url: this.generateUrl(1), active: false });
            if (start > 2) {
                pages.push({ page: -1, url: '', active: false }); // Ellipsis marker
            }
        }
        // Add pages in range
        for (let i = start; i <= end; i++) {
            pages.push({
                page: i,
                url: this.generateUrl(i),
                active: i === this.page,
            });
        }
        // Add last page if not in range
        if (end < totalPages) {
            if (end < totalPages - 1) {
                pages.push({ page: -1, url: '', active: false }); // Ellipsis marker
            }
            pages.push({ page: totalPages, url: this.generateUrl(totalPages), active: false });
        }
        return pages;
    }
    /**
     * Generate URL for a page
     */
    generateUrl(page) {
        const { path, queryParam, perPageParam } = this.options;
        const params = new URLSearchParams();
        params.set(queryParam, String(page));
        if (this.perPage !== 15) {
            params.set(perPageParam, String(this.perPage));
        }
        return `${path}?${params.toString()}`;
    }
    /**
     * Get paginated items
     */
    getItems() {
        return this.items;
    }
    /**
     * Get current page
     */
    currentPage() {
        return this.page;
    }
    /**
     * Get items per page
     */
    getPerPage() {
        return this.perPage;
    }
    /**
     * Get total items count
     */
    total() {
        return this.totalItems;
    }
    /**
     * Get total pages
     */
    lastPage() {
        return Math.ceil(this.totalItems / this.perPage);
    }
    /**
     * Check if there are more pages
     */
    hasMorePages() {
        return this.page < this.lastPage();
    }
    /**
     * Get first item number on this page
     */
    firstItem() {
        return this.totalItems > 0 ? (this.page - 1) * this.perPage + 1 : 0;
    }
    /**
     * Get last item number on this page
     */
    lastItem() {
        return Math.min(this.page * this.perPage, this.totalItems);
    }
    /**
     * Convert to simple array
     */
    all() {
        return this.items;
    }
    /**
     * Iterate over items
     */
    [Symbol.iterator]() {
        return this.items[Symbol.iterator]();
    }
    /**
     * Map over items
     */
    map(callback) {
        return this.items.map(callback);
    }
    /**
     * Filter items
     */
    filter(callback) {
        return this.items.filter(callback);
    }
    /**
     * Check if empty
     */
    isEmpty() {
        return this.items.length === 0;
    }
    /**
     * Check if not empty
     */
    isNotEmpty() {
        return this.items.length > 0;
    }
}
exports.Paginator = Paginator;
// ============================================
// Simple Paginator (no total count)
// ============================================
class SimplePaginator {
    items;
    page;
    perPage;
    hasMore;
    options;
    constructor(items, page = 1, perPage = 15, hasMore = false, options = {}) {
        this.items = items;
        this.page = Math.max(1, page);
        this.perPage = Math.max(1, perPage);
        this.hasMore = hasMore;
        this.options = {
            path: '/',
            queryParam: 'page',
            ...options,
        };
    }
    toJSON() {
        return {
            data: this.items,
            meta: {
                currentPage: this.page,
                perPage: this.perPage,
                hasNextPage: this.hasMore,
                hasPrevPage: this.page > 1,
            },
            links: {
                prev: this.page > 1 ? this.generateUrl(this.page - 1) : null,
                next: this.hasMore ? this.generateUrl(this.page + 1) : null,
            },
        };
    }
    generateUrl(page) {
        const { path, queryParam } = this.options;
        return `${path}?${queryParam}=${page}`;
    }
    getItems() {
        return this.items;
    }
    hasMorePages() {
        return this.hasMore;
    }
}
exports.SimplePaginator = SimplePaginator;
// ============================================
// Cursor Paginator (for infinite scroll)
// ============================================
class CursorPaginator {
    items;
    cursor;
    nextCursor;
    perPage;
    options;
    constructor(items, cursor, nextCursor, perPage = 15, options = {}) {
        this.items = items;
        this.cursor = cursor;
        this.nextCursor = nextCursor;
        this.perPage = perPage;
        this.options = {
            path: '/',
            queryParam: 'cursor',
            ...options,
        };
    }
    toJSON() {
        return {
            data: this.items,
            meta: {
                perPage: this.perPage,
                hasNextPage: this.nextCursor !== null,
                hasPrevPage: this.cursor !== null,
                nextCursor: this.nextCursor,
                prevCursor: this.cursor,
            },
            links: {
                next: this.nextCursor ? this.generateUrl(this.nextCursor) : null,
            },
        };
    }
    generateUrl(cursor) {
        const { path, queryParam } = this.options;
        return `${path}?${queryParam}=${encodeURIComponent(cursor)}`;
    }
    getItems() {
        return this.items;
    }
    hasMorePages() {
        return this.nextCursor !== null;
    }
    getNextCursor() {
        return this.nextCursor;
    }
}
exports.CursorPaginator = CursorPaginator;
// ============================================
// Helper Functions
// ============================================
/**
 * Create a paginated result
 */
function paginate(items, total, page, perPage, options) {
    return new Paginator(items, total, page, perPage, options);
}
/**
 * Create a simple paginated result (no total count)
 */
function simplePaginate(items, page, perPage, hasMore, options) {
    return new SimplePaginator(items, page, perPage, hasMore, options);
}
/**
 * Create a cursor paginated result
 */
function cursorPaginate(items, cursor, nextCursor, perPage, options) {
    return new CursorPaginator(items, cursor, nextCursor, perPage, options);
}
exports.default = Paginator;
