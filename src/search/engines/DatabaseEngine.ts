import { SearchEngine, SearchBuilder } from './Engine';
import { Model } from '../../mvc/Model';

export class DatabaseEngine implements SearchEngine {
  protected softDelete: boolean = false;

  constructor(config: { softDelete?: boolean } = {}) {
     this.softDelete = config.softDelete || false;
  }

  async update(models: Model[]): Promise<void> {
    // Database engine usually doesn't need indexing as it queries DB directly
    // But if we have a separate 'search_index' table, we would update it here.
    // For simple LIKE implementation: do nothing.
  }

  async delete(models: Model[]): Promise<void> {
    // Do nothing for simple LIKE search
  }

  async search(builder: SearchBuilder): Promise<any[]> {
    return this.buildQuery(builder).get();
  }

  async paginate(builder: SearchBuilder, perPage: number, page: number): Promise<any> {
    return this.buildQuery(builder).paginate(perPage, page);
  }

  async map(results: any[], model: typeof Model): Promise<Model[]> {
    // Results are already models if using Eloquent/QueryBuilder
    if (results.length === 0) return [];
    
    // If results are IDs (unlikely for simple DB search), map them.
    // Assuming results are rows/models:
    return results; // They are already hydrated by QueryBuilder usually
  }

  async mapIds(results: any[]): Promise<any[]> {
    return results.map((item: any) => item.id);
  }

  async flush(model: typeof Model): Promise<void> {
    // Do nothing
  }

  protected buildQuery(builder: SearchBuilder) {
    const query = builder.query;
    const model = builder.model as any; // Cast to access static methods
    
    // Start query
    const dbQuery = model.query ? model.query() : (model as any); 

    // Basic LIKE search on all columns? Or specified ones?
    // We need 'toSearchableArray' or 'searchableAs' metadata ideally.
    // For now, let's assume 'searchable' columns are defined or we default to nothing which is bad.
    // Let's assume the Model has `searchable` property.
    
    const searchable = (new model()).searchable || [];
    
    if (searchable.length > 0) {
        dbQuery.where(function(q: any) {
            for (const col of searchable) {
                q.orWhere(col, 'LIKE', `%${query}%`);
            }
        });
    }

    // Apply filters
    for (const [key, value] of Object.entries(builder.wheres)) {
        dbQuery.where(key, value);
    }
    
    // Apply orders
    for (const order of builder.orders) {
        dbQuery.orderBy(order.column, order.direction);
    }
    
    if (builder.limitVal) {
        dbQuery.limit(builder.limitVal);
    }
    
    if (builder.callback) {
        builder.callback(dbQuery);
    }

    return dbQuery;
  }
}
