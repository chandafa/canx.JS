"use strict";
/**
 * CanxJS API Resources (Transformers)
 * Transform model data for API responses
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceCollection = exports.Resource = void 0;
exports.paginatedResource = paginatedResource;
exports.when = when;
exports.whenNotNull = whenNotNull;
exports.mergeWhen = mergeWhen;
exports.resource = resource;
exports.collection = collection;
// ============================================
// Base Resource Class
// ============================================
class Resource {
    resource;
    includes = [];
    excludes = [];
    constructor(resource) {
        this.resource = resource;
    }
    /**
     * Include additional fields
     */
    include(...fields) {
        this.includes.push(...fields);
        return this;
    }
    /**
     * Exclude fields from output
     */
    exclude(...fields) {
        this.excludes.push(...fields);
        return this;
    }
    /**
     * Check if a field should be included
     */
    shouldInclude(field) {
        if (this.excludes.includes(field))
            return false;
        if (this.includes.length > 0)
            return this.includes.includes(field);
        return true;
    }
    /**
     * Apply includes/excludes to output
     */
    filterOutput(data) {
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            if (this.shouldInclude(key)) {
                result[key] = value;
            }
        }
        return result;
    }
    /**
     * Get transformed data
     */
    toJSON() {
        return this.filterOutput(this.toArray());
    }
    /**
     * Create response with wrapper
     */
    response(wrap = 'data') {
        const data = this.toJSON();
        if (wrap === false)
            return data;
        return { [wrap]: data };
    }
    /**
     * Static factory for collections
     */
    static collection(items) {
        return new ResourceCollection(items, this);
    }
}
exports.Resource = Resource;
// ============================================
// Resource Collection
// ============================================
class ResourceCollection {
    items;
    ResourceClass;
    meta = {};
    collectionIncludes = [];
    collectionExcludes = [];
    constructor(items, ResourceClass) {
        this.items = items;
        this.ResourceClass = ResourceClass;
    }
    /**
     * Add metadata to collection
     */
    withMeta(meta) {
        this.meta = { ...this.meta, ...meta };
        return this;
    }
    /**
     * Add pagination metadata
     */
    withPagination(pagination) {
        this.meta.pagination = pagination;
        return this;
    }
    /**
     * Include fields for all items
     */
    include(...fields) {
        this.collectionIncludes.push(...fields);
        return this;
    }
    /**
     * Exclude fields for all items
     */
    exclude(...fields) {
        this.collectionExcludes.push(...fields);
        return this;
    }
    /**
     * Transform all items
     */
    toArray() {
        return this.items.map(item => {
            const resource = new this.ResourceClass(item);
            if (this.collectionIncludes.length)
                resource.include(...this.collectionIncludes);
            if (this.collectionExcludes.length)
                resource.exclude(...this.collectionExcludes);
            return resource.toJSON();
        });
    }
    /**
     * Get response object
     */
    response(wrap = 'data') {
        const data = this.toArray();
        if (wrap === false) {
            return Object.keys(this.meta).length > 0
                ? { items: data, meta: this.meta }
                : { items: data };
        }
        const response = { [wrap]: data };
        if (Object.keys(this.meta).length > 0) {
            response.meta = this.meta;
        }
        return response;
    }
    /**
     * Get JSON (shorthand for response)
     */
    toJSON() {
        return this.response();
    }
}
exports.ResourceCollection = ResourceCollection;
/**
 * Create paginated resource response
 */
function paginatedResource(paginated, ResourceClass, baseUrl) {
    const collection = new ResourceCollection(paginated.data, ResourceClass);
    const from = ((paginated.currentPage - 1) * paginated.perPage) + 1;
    const to = Math.min(paginated.currentPage * paginated.perPage, paginated.total);
    collection.withPagination({
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
        perPage: paginated.perPage,
        total: paginated.total,
        from: paginated.total > 0 ? from : 0,
        to: paginated.total > 0 ? to : 0,
    });
    if (baseUrl) {
        const links = {
            first: `${baseUrl}?page=1`,
            last: `${baseUrl}?page=${paginated.lastPage}`,
        };
        if (paginated.currentPage > 1) {
            links.prev = `${baseUrl}?page=${paginated.currentPage - 1}`;
        }
        if (paginated.currentPage < paginated.lastPage) {
            links.next = `${baseUrl}?page=${paginated.currentPage + 1}`;
        }
        collection.withMeta({ links });
    }
    return collection.response();
}
function when(condition, value, fallback) {
    return condition ? value : fallback;
}
/**
 * Include value only when it's not null/undefined
 */
function whenNotNull(value) {
    return value ?? undefined;
}
/**
 * Merge conditionally
 */
function mergeWhen(condition, data) {
    return condition ? data : {};
}
// ============================================
// Anonymous Resource Helper
// ============================================
/**
 * Create an anonymous resource from a transform function
 */
function resource(data, transform) {
    return transform(data);
}
/**
 * Create anonymous collection resource
 */
function collection(items, transform) {
    return items.map(transform);
}
// ============================================
// Example Resource (for reference)
// ============================================
// Example usage:
// 
// class UserResource extends Resource<User> {
//   toArray() {
//     return {
//       id: this.resource.id,
//       name: this.resource.name,
//       email: this.resource.email,
//       createdAt: this.resource.created_at,
//       ...mergeWhen(this.shouldInclude('secret'), {
//         secret: this.resource.secret,
//       }),
//     };
//   }
// }
//
// // Single resource
// return new UserResource(user).response();
//
// // Collection
// return UserResource.collection(users).response();
//
// // With exclusions
// return new UserResource(user).exclude('email').response();
