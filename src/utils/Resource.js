"use strict";
/**
 * CanxJS Resource - API Resource transformers
 * Laravel-compatible JSON resources with TypeScript improvements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Resource = exports.AnonymousResource = exports.ResourceCollection = exports.JsonResource = void 0;
exports.resource = resource;
exports.collection = collection;
exports.wrap = wrap;
exports.success = success;
exports.error = error;
exports.when = when;
exports.whenNotNull = whenNotNull;
exports.whenLoaded = whenLoaded;
exports.mergeWhen = mergeWhen;
const Paginator_1 = require("./Paginator");
// ============================================
// JsonResource Base Class
// ============================================
class JsonResource {
    resource;
    request;
    additionalMeta = {};
    additionalLinks = {};
    withoutWrapping = false;
    constructor(resource) {
        this.resource = resource;
    }
    /**
     * Add additional meta data
     */
    additional(meta) {
        this.additionalMeta = { ...this.additionalMeta, ...meta };
        return this;
    }
    /**
     * Add additional links
     */
    withLinks(links) {
        this.additionalLinks = { ...this.additionalLinks, ...links };
        return this;
    }
    /**
     * Disable data wrapping
     */
    withoutWrappingData() {
        this.withoutWrapping = true;
        return this;
    }
    /**
     * Set the request for context
     */
    withRequest(request) {
        this.request = request;
        return this;
    }
    /**
     * Get the underlying resource
     */
    getResource() {
        return this.resource;
    }
    /**
     * Transform to JSON response
     */
    toJSON() {
        const data = this.toArray(this.request);
        if (this.withoutWrapping) {
            return {
                ...data,
                ...this.additionalMeta,
            };
        }
        const response = { data };
        if (Object.keys(this.additionalMeta).length > 0) {
            response.meta = this.additionalMeta;
        }
        if (Object.keys(this.additionalLinks).length > 0) {
            response.links = this.additionalLinks;
        }
        return response;
    }
    /**
     * Create response
     */
    response(res, status = 200) {
        return res.status(status).json(this.toJSON());
    }
    /**
     * Create a collection of resources
     */
    static collection(ResourceClass, items) {
        return new ResourceCollection(ResourceClass, items);
    }
}
exports.JsonResource = JsonResource;
exports.Resource = JsonResource;
// ============================================
// ResourceCollection Class
// ============================================
class ResourceCollection {
    ResourceClass;
    items;
    request;
    additionalMeta = {};
    additionalLinks = {};
    withoutWrapping = false;
    isPaginated = false;
    paginator;
    constructor(ResourceClass, items) {
        this.ResourceClass = ResourceClass;
        if (items instanceof Paginator_1.Paginator) {
            this.isPaginated = true;
            this.paginator = items;
            this.items = items.getItems();
        }
        else {
            this.items = items;
        }
    }
    /**
     * Add additional meta data
     */
    additional(meta) {
        this.additionalMeta = { ...this.additionalMeta, ...meta };
        return this;
    }
    /**
     * Add additional links
     */
    withLinks(links) {
        this.additionalLinks = { ...this.additionalLinks, ...links };
        return this;
    }
    /**
     * Disable data wrapping
     */
    withoutWrappingData() {
        this.withoutWrapping = true;
        return this;
    }
    /**
     * Set the request for context
     */
    withRequest(request) {
        this.request = request;
        return this;
    }
    /**
     * Transform each item
     */
    transformItems() {
        return this.items.map(item => {
            const resource = new this.ResourceClass(item);
            if (this.request)
                resource.withRequest(this.request);
            return resource.toArray(this.request);
        });
    }
    /**
     * Transform to JSON response
     */
    toJSON() {
        const data = this.transformItems();
        if (this.withoutWrapping) {
            return data;
        }
        const response = { data };
        // Add pagination meta
        if (this.isPaginated && this.paginator) {
            const paginationMeta = this.paginator.getMeta();
            response.meta = {
                ...paginationMeta,
                ...this.additionalMeta,
            };
            const paginationLinks = this.paginator.getLinks();
            response.links = {
                first: paginationLinks.first || undefined,
                last: paginationLinks.last || undefined,
                prev: paginationLinks.prev || undefined,
                next: paginationLinks.next || undefined,
                ...this.additionalLinks,
            };
        }
        else {
            if (Object.keys(this.additionalMeta).length > 0) {
                response.meta = this.additionalMeta;
            }
            if (Object.keys(this.additionalLinks).length > 0) {
                response.links = this.additionalLinks;
            }
        }
        return response;
    }
    /**
     * Create response
     */
    response(res, status = 200) {
        return res.status(status).json(this.toJSON());
    }
}
exports.ResourceCollection = ResourceCollection;
// ============================================
// AnonymousResource (for quick transformations)
// ============================================
class AnonymousResource extends JsonResource {
    transformer;
    constructor(resource, transformer) {
        super(resource);
        this.transformer = transformer;
    }
    toArray(request) {
        return this.transformer(this.resource, request);
    }
}
exports.AnonymousResource = AnonymousResource;
// ============================================
// Helper Functions
// ============================================
/**
 * Create a resource from any data
 */
function resource(data, transformer) {
    return new AnonymousResource(data, transformer);
}
/**
 * Create a collection of resources
 */
function collection(ResourceClass, items) {
    return new ResourceCollection(ResourceClass, items);
}
/**
 * Create a simple JSON response wrapper
 */
function wrap(data, meta) {
    const response = { data };
    if (meta)
        response.meta = meta;
    return response;
}
/**
 * Create a success response
 */
function success(data, message) {
    return {
        success: true,
        data,
        ...(message && { message }),
    };
}
/**
 * Create an error response
 */
function error(message, errors) {
    return {
        success: false,
        error: message,
        ...(errors && { errors }),
    };
}
// ============================================
// Conditional Helpers for Resources
// ============================================
/**
 * Include attribute only when condition is true
 */
function when(condition, value) {
    if (!condition)
        return undefined;
    return typeof value === 'function' ? value() : value;
}
/**
 * Include attribute only when it's not null
 */
function whenNotNull(value) {
    return value ?? undefined;
}
/**
 * Include attribute when callback returns true
 */
function whenLoaded(relation, resource, value) {
    if (!(relation in resource) || resource[relation] === undefined) {
        return undefined;
    }
    return typeof value === 'function' ? value() : value;
}
/**
 * Merge attributes conditionally
 */
function mergeWhen(condition, attributes) {
    return condition ? attributes : {};
}
exports.default = JsonResource;
