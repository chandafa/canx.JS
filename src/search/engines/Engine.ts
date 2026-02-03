import { Model } from '../../mvc/Model';

export interface SearchEngine {
  update(models: Model[]): Promise<void>;
  delete(models: Model[]): Promise<void>;
  search(builder: SearchBuilder): Promise<any[]>;
  paginate(builder: SearchBuilder, perPage: number, page: number): Promise<any>;
  map(results: any[], model: typeof Model): Promise<Model[]>;
  mapIds(results: any[]): Promise<any[]>;
  flush(model: typeof Model): Promise<void>;
}

export class SearchBuilder {
  public model: typeof Model;
  public query: string;
  public callback?: (query: any) => any;
  public limitVal?: number;
  public wheres: Record<string, any> = {};
  public orders: { column: string; direction: 'asc' | 'desc' }[] = [];

  constructor(model: typeof Model, query: string, callback?: (query: any) => any) {
    this.model = model;
    this.query = query;
    this.callback = callback;
  }

  where(key: string, value: any): this {
    this.wheres[key] = value;
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orders.push({ column, direction });
    return this;
  }

  take(count: number): this {
    this.limitVal = count;
    return this;
  }
}
