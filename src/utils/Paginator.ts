/**
 * CanxJS Paginator - Database pagination helper
 * Laravel-compatible pagination with improved API
 */

// ============================================
// Types
// ============================================

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
  path?: string;           // Base URL path
  queryParam?: string;     // Query parameter name (default: 'page')
  perPageParam?: string;   // Per-page query param (default: 'per_page')
  surroundingPages?: number; // Pages to show around current (default: 3)
}

// ============================================
// Paginator Class
// ============================================

export class Paginator<T = unknown> {
  private items: T[];
  private page: number;
  private perPage: number;
  private totalItems: number;
  private options: PaginatorOptions;

  constructor(
    items: T[],
    total: number,
    page: number = 1,
    perPage: number = 15,
    options: PaginatorOptions = {}
  ) {
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
  toJSON(): PaginatedResult<T> {
    return {
      data: this.items,
      meta: this.getMeta(),
      links: this.getLinks(),
    };
  }

  /**
   * Get pagination metadata
   */
  getMeta(): PaginationMeta {
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
  getLinks(): PaginationLinks {
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
  private generatePageLinks(totalPages: number): PageLink[] {
    const pages: PageLink[] = [];
    const surrounding = this.options.surroundingPages!;
    
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
  private generateUrl(page: number): string {
    const { path, queryParam, perPageParam } = this.options;
    const params = new URLSearchParams();
    
    params.set(queryParam!, String(page));
    if (this.perPage !== 15) {
      params.set(perPageParam!, String(this.perPage));
    }

    return `${path}?${params.toString()}`;
  }

  /**
   * Get paginated items
   */
  getItems(): T[] {
    return this.items;
  }

  /**
   * Get current page
   */
  currentPage(): number {
    return this.page;
  }

  /**
   * Get items per page
   */
  getPerPage(): number {
    return this.perPage;
  }

  /**
   * Get total items count
   */
  total(): number {
    return this.totalItems;
  }

  /**
   * Get total pages
   */
  lastPage(): number {
    return Math.ceil(this.totalItems / this.perPage);
  }

  /**
   * Check if there are more pages
   */
  hasMorePages(): boolean {
    return this.page < this.lastPage();
  }

  /**
   * Get first item number on this page
   */
  firstItem(): number {
    return this.totalItems > 0 ? (this.page - 1) * this.perPage + 1 : 0;
  }

  /**
   * Get last item number on this page
   */
  lastItem(): number {
    return Math.min(this.page * this.perPage, this.totalItems);
  }

  /**
   * Convert to simple array
   */
  all(): T[] {
    return this.items;
  }

  /**
   * Iterate over items
   */
  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }

  /**
   * Map over items
   */
  map<U>(callback: (item: T, index: number) => U): U[] {
    return this.items.map(callback);
  }

  /**
   * Filter items
   */
  filter(callback: (item: T, index: number) => boolean): T[] {
    return this.items.filter(callback);
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Check if not empty
   */
  isNotEmpty(): boolean {
    return this.items.length > 0;
  }
}

// ============================================
// Simple Paginator (no total count)
// ============================================

export class SimplePaginator<T = unknown> {
  private items: T[];
  private page: number;
  private perPage: number;
  private hasMore: boolean;
  private options: PaginatorOptions;

  constructor(
    items: T[],
    page: number = 1,
    perPage: number = 15,
    hasMore: boolean = false,
    options: PaginatorOptions = {}
  ) {
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

  private generateUrl(page: number): string {
    const { path, queryParam } = this.options;
    return `${path}?${queryParam}=${page}`;
  }

  getItems(): T[] {
    return this.items;
  }

  hasMorePages(): boolean {
    return this.hasMore;
  }
}

// ============================================
// Cursor Paginator (for infinite scroll)
// ============================================

export class CursorPaginator<T = unknown> {
  private items: T[];
  private cursor: string | null;
  private nextCursor: string | null;
  private perPage: number;
  private options: PaginatorOptions;

  constructor(
    items: T[],
    cursor: string | null,
    nextCursor: string | null,
    perPage: number = 15,
    options: PaginatorOptions = {}
  ) {
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

  private generateUrl(cursor: string): string {
    const { path, queryParam } = this.options;
    return `${path}?${queryParam}=${encodeURIComponent(cursor)}`;
  }

  getItems(): T[] {
    return this.items;
  }

  hasMorePages(): boolean {
    return this.nextCursor !== null;
  }

  getNextCursor(): string | null {
    return this.nextCursor;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create a paginated result
 */
export function paginate<T>(
  items: T[],
  total: number,
  page?: number,
  perPage?: number,
  options?: PaginatorOptions
): Paginator<T> {
  return new Paginator(items, total, page, perPage, options);
}

/**
 * Create a simple paginated result (no total count)
 */
export function simplePaginate<T>(
  items: T[],
  page?: number,
  perPage?: number,
  hasMore?: boolean,
  options?: PaginatorOptions
): SimplePaginator<T> {
  return new SimplePaginator(items, page, perPage, hasMore, options);
}

/**
 * Create a cursor paginated result
 */
export function cursorPaginate<T>(
  items: T[],
  cursor: string | null,
  nextCursor: string | null,
  perPage?: number,
  options?: PaginatorOptions
): CursorPaginator<T> {
  return new CursorPaginator(items, cursor, nextCursor, perPage, options);
}

export default Paginator;
