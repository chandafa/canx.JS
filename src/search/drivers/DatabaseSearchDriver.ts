import type { SearchDriver, SearchResult, SearchBuilder, Searchable } from '../types';

export class DatabaseSearchDriver implements SearchDriver {
  /**
   * Update the index for the given models.
   * For database driver, this is a no-op as data is already in DB.
   */
  async update(models: Searchable[]): Promise<void> {
    // No-op
  }

  /**
   * Remove the given models from the index.
   * For database driver, this is a no-op.
   */
  async delete(models: Searchable[]): Promise<void> {
    // No-op
  }

  /**
   * Perform a search on the index using simple LIKE queries.
   */
  async search(builder: SearchBuilder): Promise<SearchResult> {
    // This assumes the model has a static 'query' method or similar
    // In a real implementation, we would use the Model's query builder.
    // Since we don't have direct access to the query builder API here without
    // importing Model (which might cause circular deps), we will describe the logic.
    
    // Simulating query builder usage:
    // const query = (builder.model as any).query();
    
    // We would assume the model is a CanxJS Model
    const modelClass = builder.model as any;
    
    // If the model doesn't have a query method, we can't search
    if (typeof modelClass.query !== 'function') {
      throw new Error(`Model ${modelClass.name} does not appear to be a searchable CanxJS Model.`);
    }

    const query = modelClass.query();
    const instance = new modelClass();
    const searchableFields = instance.toSearchableArray ? Object.keys(instance.toSearchableArray()) : [];

    // Basic "WHERE LIKE" search across searchable fields
    if (builder.query && searchableFields.length > 0) {
      query.where(function(q: any) {
        searchableFields.forEach((field: string, index: number) => {
          if (index === 0) {
            q.where(field, 'LIKE', `%${builder.query}%`);
          } else {
            q.orWhere(field, 'LIKE', `%${builder.query}%`);
          }
        });
      });
    }

    // Apply filters
    Object.entries(builder.filters).forEach(([key, value]) => {
      query.where(key, value);
    });

    // Apply sorts
    Object.entries(builder.sorts).forEach(([key, direction]) => {
      query.orderBy(key, direction);
    });

    // Pagination
    const total = await query.count();
    const offset = (builder.page - 1) * builder.limit;
    
    // Get results
    const hits = await query.offset(offset).limit(builder.limit).get();

    return {
      hits,
      total,
      processingTimeMs: 0, // Not measured
      query: builder.query,
    };
  }
}
