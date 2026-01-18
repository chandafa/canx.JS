/**
 * CanxJS Resource - API Resource transformers
 * Laravel-compatible JSON resources with TypeScript improvements
 */

import type { CanxRequest, CanxResponse } from '../types';
import { Paginator, PaginatedResult } from './Paginator';

// ============================================
// Types
// ============================================

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

// ============================================
// JsonResource Base Class
// ============================================

export abstract class JsonResource<T = unknown> {
  protected resource: T;
  protected request?: CanxRequest;
  protected additionalMeta: ResourceMeta = {};
  protected additionalLinks: ResourceLinks = {};
  protected withoutWrapping: boolean = false;

  constructor(resource: T) {
    this.resource = resource;
  }

  /**
   * Transform the resource into an array/object
   * Must be implemented in subclass
   */
  abstract toArray(request?: CanxRequest): Record<string, unknown>;

  /**
   * Add additional meta data
   */
  additional(meta: ResourceMeta): this {
    this.additionalMeta = { ...this.additionalMeta, ...meta };
    return this;
  }

  /**
   * Add additional links
   */
  withLinks(links: ResourceLinks): this {
    this.additionalLinks = { ...this.additionalLinks, ...links };
    return this;
  }

  /**
   * Disable data wrapping
   */
  withoutWrappingData(): this {
    this.withoutWrapping = true;
    return this;
  }

  /**
   * Set the request for context
   */
  withRequest(request: CanxRequest): this {
    this.request = request;
    return this;
  }

  /**
   * Get the underlying resource
   */
  getResource(): T {
    return this.resource;
  }

  /**
   * Transform to JSON response
   */
  toJSON(): ResourceResponse {
    const data = this.toArray(this.request);

    if (this.withoutWrapping) {
      return {
        ...data,
        ...this.additionalMeta,
      } as unknown as ResourceResponse;
    }

    const response: ResourceResponse = { data };

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
  response(res: CanxResponse, status: number = 200): Response {
    return res.status(status).json(this.toJSON());
  }

  /**
   * Create a collection of resources
   */
  static collection<R extends JsonResource<T>, T>(
    ResourceClass: new (resource: T) => R,
    items: T[]
  ): ResourceCollection<R, T> {
    return new ResourceCollection(ResourceClass, items);
  }
}

// ============================================
// ResourceCollection Class
// ============================================

export class ResourceCollection<R extends JsonResource<T>, T = unknown> {
  private ResourceClass: new (resource: T) => R;
  private items: T[];
  private request?: CanxRequest;
  private additionalMeta: ResourceMeta = {};
  private additionalLinks: ResourceLinks = {};
  private withoutWrapping: boolean = false;
  private isPaginated: boolean = false;
  private paginator?: Paginator<T>;

  constructor(ResourceClass: new (resource: T) => R, items: T[] | Paginator<T>) {
    this.ResourceClass = ResourceClass;
    
    if (items instanceof Paginator) {
      this.isPaginated = true;
      this.paginator = items;
      this.items = items.getItems();
    } else {
      this.items = items;
    }
  }

  /**
   * Add additional meta data
   */
  additional(meta: ResourceMeta): this {
    this.additionalMeta = { ...this.additionalMeta, ...meta };
    return this;
  }

  /**
   * Add additional links
   */
  withLinks(links: ResourceLinks): this {
    this.additionalLinks = { ...this.additionalLinks, ...links };
    return this;
  }

  /**
   * Disable data wrapping
   */
  withoutWrappingData(): this {
    this.withoutWrapping = true;
    return this;
  }

  /**
   * Set the request for context
   */
  withRequest(request: CanxRequest): this {
    this.request = request;
    return this;
  }

  /**
   * Transform each item
   */
  private transformItems(): Record<string, unknown>[] {
    return this.items.map(item => {
      const resource = new this.ResourceClass(item);
      if (this.request) resource.withRequest(this.request);
      return resource.toArray(this.request);
    });
  }

  /**
   * Transform to JSON response
   */
  toJSON(): ResourceResponse<Record<string, unknown>[]> {
    const data = this.transformItems();
    
    if (this.withoutWrapping) {
      return data as unknown as ResourceResponse<Record<string, unknown>[]>;
    }

    const response: ResourceResponse<Record<string, unknown>[]> = { data };

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
    } else {
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
  response(res: CanxResponse, status: number = 200): Response {
    return res.status(status).json(this.toJSON());
  }
}

// ============================================
// AnonymousResource (for quick transformations)
// ============================================

export class AnonymousResource<T = unknown> extends JsonResource<T> {
  private transformer: (resource: T, request?: CanxRequest) => Record<string, unknown>;

  constructor(
    resource: T, 
    transformer: (resource: T, request?: CanxRequest) => Record<string, unknown>
  ) {
    super(resource);
    this.transformer = transformer;
  }

  toArray(request?: CanxRequest): Record<string, unknown> {
    return this.transformer(this.resource, request);
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create a resource from any data
 */
export function resource<T>(
  data: T,
  transformer: (resource: T, request?: CanxRequest) => Record<string, unknown>
): AnonymousResource<T> {
  return new AnonymousResource(data, transformer);
}

/**
 * Create a collection of resources
 */
export function collection<R extends JsonResource<T>, T>(
  ResourceClass: new (resource: T) => R,
  items: T[] | Paginator<T>
): ResourceCollection<R, T> {
  return new ResourceCollection(ResourceClass, items);
}

/**
 * Create a simple JSON response wrapper
 */
export function wrap<T>(data: T, meta?: ResourceMeta): ResourceResponse<T> {
  const response: ResourceResponse<T> = { data };
  if (meta) response.meta = meta;
  return response;
}

/**
 * Create a success response
 */
export function success<T>(data: T, message?: string): ResourceResponse<T> & { success: true; message?: string } {
  return {
    success: true,
    data,
    ...(message && { message }),
  };
}

/**
 * Create an error response
 */
export function error(message: string, errors?: Record<string, string[]>): { success: false; error: string; errors?: Record<string, string[]> } {
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
export function when<T>(condition: boolean, value: T | (() => T)): T | undefined {
  if (!condition) return undefined;
  return typeof value === 'function' ? (value as () => T)() : value;
}

/**
 * Include attribute only when it's not null
 */
export function whenNotNull<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

/**
 * Include attribute when callback returns true
 */
export function whenLoaded<T>(
  relation: string, 
  resource: Record<string, unknown>,
  value: T | (() => T)
): T | undefined {
  if (!(relation in resource) || resource[relation] === undefined) {
    return undefined;
  }
  return typeof value === 'function' ? (value as () => T)() : value;
}

/**
 * Merge attributes conditionally
 */
export function mergeWhen(
  condition: boolean, 
  attributes: Record<string, unknown>
): Record<string, unknown> {
  return condition ? attributes : {};
}

export { JsonResource as Resource };
export default JsonResource;
