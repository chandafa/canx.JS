/**
 * CanxJS Search - Full-text search abstraction
 */

export interface Searchable {
  /**
   * Get the index name for the model.
   */
  searchableAs(): string;

  /**
   * Get the indexable data array for the model.
   */
  toSearchableArray(): Record<string, unknown>;

  /**
   * Get the value used to index the model.
   */
  getScoutKey(): string | number;

  /**
   * Get the key name used to index the model.
   */
  getScoutKeyName(): string;
}

export interface SearchResult<T = unknown> {
  hits: T[];
  total: number;
  processingTimeMs: number;
  query: string;
}

export interface SearchDriver {
  /**
   * Update the index for the given models.
   */
  update(models: Searchable[]): Promise<void>;

  /**
   * Remove the given models from the index.
   */
  delete(models: Searchable[]): Promise<void>;

  /**
   * Perform a search on the index.
   */
  search(
    builder: SearchBuilder
  ): Promise<SearchResult>;
}

export class SearchBuilder {
  public query: string;
  public model: new () => Searchable;
  public limit: number = 20;
  public page: number = 1;
  public filters: Record<string, unknown> = {};
  public sorts: Record<string, 'asc' | 'desc'> = {};

  constructor(model: new () => Searchable, query: string) {
    this.model = model;
    this.query = query;
  }

  where(key: string, value: unknown): this {
    this.filters[key] = value;
    return this;
  }

  orderBy(key: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.sorts[key] = direction;
    return this;
  }

  take(limit: number): this {
    this.limit = limit;
    return this;
  }

  paginate(page: number, limit?: number): this {
    this.page = page;
    if (limit) this.limit = limit;
    return this;
  }
}
