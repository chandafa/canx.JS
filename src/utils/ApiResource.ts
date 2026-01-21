/**
 * CanxJS API Resources (Transformers)
 * Transform model data for API responses
 */

// ============================================
// Types
// ============================================

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
  wrap?: string | false; // Wrap data in key (default: 'data')
  withMeta?: boolean;
  includes?: string[];
  excludes?: string[];
}

// ============================================
// Base Resource Class
// ============================================

export abstract class Resource<T = unknown> {
  protected resource: T;
  protected includes: string[] = [];
  protected excludes: string[] = [];

  constructor(resource: T) {
    this.resource = resource;
  }

  /**
   * Define how to transform a single item
   * Override this in child classes
   */
  abstract toArray(): Record<string, unknown>;

  /**
   * Include additional fields
   */
  include(...fields: string[]): this {
    this.includes.push(...fields);
    return this;
  }

  /**
   * Exclude fields from output
   */
  exclude(...fields: string[]): this {
    this.excludes.push(...fields);
    return this;
  }

  /**
   * Check if a field should be included
   */
  protected shouldInclude(field: string): boolean {
    if (this.excludes.includes(field)) return false;
    if (this.includes.length > 0) return this.includes.includes(field);
    return true;
  }

  /**
   * Apply includes/excludes to output
   */
  protected filterOutput(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
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
  toJSON(): Record<string, unknown> {
    return this.filterOutput(this.toArray());
  }

  /**
   * Create response with wrapper
   */
  response(wrap: string | false = 'data'): Record<string, unknown> {
    const data = this.toJSON();
    if (wrap === false) return data;
    return { [wrap]: data };
  }

  /**
   * Static factory for collections
   */
  static collection<U, R extends Resource<U>>(
    this: new (item: U) => R,
    items: U[]
  ): ResourceCollection<U, R> {
    return new ResourceCollection(items, this);
  }
}

// ============================================
// Resource Collection
// ============================================

export class ResourceCollection<T, R extends Resource<T>> {
  private items: T[];
  private ResourceClass: new (item: T) => R;
  private meta: ResourceMeta = {};
  private collectionIncludes: string[] = [];
  private collectionExcludes: string[] = [];

  constructor(items: T[], ResourceClass: new (item: T) => R) {
    this.items = items;
    this.ResourceClass = ResourceClass;
  }

  /**
   * Add metadata to collection
   */
  withMeta(meta: ResourceMeta): this {
    this.meta = { ...this.meta, ...meta };
    return this;
  }

  /**
   * Add pagination metadata
   */
  withPagination(pagination: ResourceMeta['pagination']): this {
    this.meta.pagination = pagination;
    return this;
  }

  /**
   * Include fields for all items
   */
  include(...fields: string[]): this {
    this.collectionIncludes.push(...fields);
    return this;
  }

  /**
   * Exclude fields for all items
   */
  exclude(...fields: string[]): this {
    this.collectionExcludes.push(...fields);
    return this;
  }

  /**
   * Transform all items
   */
  toArray(): Record<string, unknown>[] {
    return this.items.map(item => {
      const resource = new this.ResourceClass(item);
      if (this.collectionIncludes.length) resource.include(...this.collectionIncludes);
      if (this.collectionExcludes.length) resource.exclude(...this.collectionExcludes);
      return resource.toJSON();
    });
  }

  /**
   * Get response object
   */
  response(wrap: string | false = 'data'): Record<string, unknown> {
    const data = this.toArray();
    
    if (wrap === false) {
      return Object.keys(this.meta).length > 0 
        ? { items: data, meta: this.meta }
        : { items: data };
    }
    
    const response: Record<string, unknown> = { [wrap]: data };
    
    if (Object.keys(this.meta).length > 0) {
      response.meta = this.meta;
    }
    
    return response;
  }

  /**
   * Get JSON (shorthand for response)
   */
  toJSON(): Record<string, unknown> {
    return this.response();
  }
}

// ============================================
// Pagination Helper
// ============================================

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
export function paginatedResource<T, R extends Resource<T>>(
  paginated: PaginatedData<T>,
  ResourceClass: new (item: T) => R,
  baseUrl?: string
): Record<string, unknown> {
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
    const links: Record<string, string> = {
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

// ============================================
// Conditional Helper
// ============================================

/**
 * Include value only when condition is true
 */
export function when<T>(condition: boolean, value: T): T | undefined;
export function when<T>(condition: boolean, value: T, fallback: T): T;
export function when<T>(condition: boolean, value: T, fallback?: T): T | undefined {
  return condition ? value : fallback;
}

/**
 * Include value only when it's not null/undefined
 */
export function whenNotNull<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

/**
 * Merge conditionally
 */
export function mergeWhen(condition: boolean, data: Record<string, unknown>): Record<string, unknown> {
  return condition ? data : {};
}

// ============================================
// Anonymous Resource Helper
// ============================================

/**
 * Create an anonymous resource from a transform function
 */
export function resource<T>(
  data: T,
  transform: (item: T) => Record<string, unknown>
): Record<string, unknown> {
  return transform(data);
}

/**
 * Create anonymous collection resource
 */
export function collection<T>(
  items: T[],
  transform: (item: T) => Record<string, unknown>
): Record<string, unknown>[] {
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
